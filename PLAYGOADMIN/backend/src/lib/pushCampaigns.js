import prisma from '../prisma.js'
import {
  createNotificationWithPush,
  dispatchPush,
} from './pushNotifications.js'

export const MAX_CAMPAIGN_RECIPIENTS = 2000

export const campaignTargetWhere = (campaign) => {
  if (campaign.targetSegment === 'ALL_USERS') {
    return { role: 'USER', isBlocked: false }
  }
  if (campaign.targetSegment === 'SELECTED_USERS') {
    return { id: { in: campaign.selectedUserIds }, role: 'USER', isBlocked: false }
  }
  return {
    role: 'USER',
    isBlocked: false,
    favoriteClubs: { some: { clubId: campaign.favoriteClubId } },
  }
}

export const previewCampaign = async (campaign) => {
  const where = campaignTargetWhere(campaign)
  const [recipientCount, sample] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { id: true, email: true, username: true, name: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
  ])
  return {
    recipientCount,
    dispatchLimit: MAX_CAMPAIGN_RECIPIENTS,
    canSend: recipientCount > 0 && recipientCount <= MAX_CAMPAIGN_RECIPIENTS,
    sample,
  }
}

const mapFinalStatus = ({ sent, failed, skipped }) => {
  if (sent > 0 && failed === 0 && skipped === 0) return 'SENT'
  if (sent > 0) return 'PARTIAL'
  if (failed > 0) return 'FAILED'
  return 'SKIPPED'
}

export const sendCampaign = async (campaignId) => {
  const staleAttempt = new Date(Date.now() - 10 * 60 * 1000)
  const claimed = await prisma.pushCampaign.updateMany({
    where: {
      id: campaignId,
      OR: [
        { status: { in: ['DRAFT', 'PARTIAL', 'FAILED', 'SKIPPED'] } },
        { status: 'SENDING', sendAttemptedAt: { lt: staleAttempt } },
      ],
    },
    data: {
      status: 'SENDING',
      sendAttemptedAt: new Date(),
      lastError: null,
    },
  })
  if (claimed.count !== 1) return { deduped: true }

  const campaign = await prisma.pushCampaign.findUnique({ where: { id: campaignId } })
  const recipients = await prisma.user.findMany({
    where: campaign.audienceUserIds.length
      ? {
          id: { in: campaign.audienceUserIds },
          role: 'USER',
          isBlocked: false,
        }
      : campaignTargetWhere(campaign),
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: MAX_CAMPAIGN_RECIPIENTS + 1,
  })
  const snapshotRecipientCount =
    campaign.audienceUserIds.length || recipients.length
  if (!recipients.length || recipients.length > MAX_CAMPAIGN_RECIPIENTS) {
    const error = !recipients.length
      ? 'Campaign has no eligible recipients'
      : `Campaign exceeds the ${MAX_CAMPAIGN_RECIPIENTS} recipient safety limit`
    await prisma.pushCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        recipientCount: snapshotRecipientCount,
        lastError: error,
      },
    })
    return { status: 'FAILED', error }
  }
  if (!campaign.audienceUserIds.length) {
    await prisma.pushCampaign.update({
      where: { id: campaign.id },
      data: {
        audienceUserIds: recipients.map(({ id }) => id),
        recipientCount: recipients.length,
      },
    })
  }

  const dispatches = []
  for (const recipient of recipients) {
    const { dispatch } = await createNotificationWithPush({
      userId: recipient.id,
      type: 'MANUAL_CAMPAIGN',
      title: campaign.title,
      body: campaign.body,
      imageUrl: campaign.imageUrl,
      dedupeKey: `manual-campaign:${campaign.id}:${recipient.id}`,
      data: { ...(campaign.data ?? {}), campaignId: campaign.id },
      campaignId: campaign.id,
      queue: false,
    })
    dispatches.push(dispatch)
  }

  for (let offset = 0; offset < dispatches.length; offset += 20) {
    await Promise.all(
      dispatches.slice(offset, offset + 20).map((item) => dispatchPush(item.id)),
    )
  }
  const [deliveryTotals, skipped, unresolvedFailures, inAppCreated] = await Promise.all([
    prisma.pushDispatch.aggregate({
      where: { campaignId: campaign.id },
      _sum: { sentCount: true, failedCount: true },
    }),
    prisma.pushDispatch.count({
      where: { campaignId: campaign.id, status: 'SKIPPED' },
    }),
    prisma.pushDispatch.count({
      where: { campaignId: campaign.id, status: 'FAILED', failedCount: 0 },
    }),
    prisma.userNotification.count({ where: { campaignId: campaign.id } }),
  ])
  const sent = deliveryTotals._sum.sentCount ?? 0
  const failed = (deliveryTotals._sum.failedCount ?? 0) + unresolvedFailures
  const status = mapFinalStatus({ sent, failed, skipped })
  const updated = await prisma.pushCampaign.update({
    where: { id: campaign.id },
    data: {
      status,
      recipientCount: snapshotRecipientCount,
      inAppCreatedCount: inAppCreated,
      pushSentCount: sent,
      pushFailedCount: failed,
      pushSkippedCount: skipped,
      sentAt: sent > 0 ? new Date() : null,
      lastError:
        status === 'FAILED'
          ? 'Push delivery failed for every dispatch; in-app notifications remain available'
          : status === 'SKIPPED'
            ? 'Push delivery skipped; verify FCM credentials and registered tokens'
            : null,
    },
  })
  return { campaign: updated, deduped: false }
}

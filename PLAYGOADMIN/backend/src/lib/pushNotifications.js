import prisma from '../prisma.js'
import { sendFcmMulticast } from './fcm.js'

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

let pushSender = sendFcmMulticast
let dispatchScheduler = (callback) => setImmediate(callback)

export const setPushSenderForTests = (sender) => {
  pushSender = sender || sendFcmMulticast
}

export const setPushSchedulerForTests = (scheduler) => {
  dispatchScheduler = scheduler || ((callback) => setImmediate(callback))
}

const stringData = (data = {}) =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      ]),
  )

export const dispatchPush = async (dispatchId) => {
  const staleAttempt = new Date(Date.now() - 5 * 60 * 1000)
  const claimed = await prisma.pushDispatch.updateMany({
    where: {
      id: dispatchId,
      OR: [
        { status: { in: ['PENDING', 'FAILED', 'SKIPPED'] } },
        { status: 'SENDING', attemptedAt: { lt: staleAttempt } },
      ],
    },
    data: {
      status: 'SENDING',
      attemptedAt: new Date(),
      lastError: null,
      skippedReason: null,
    },
  })
  if (claimed.count !== 1) {
    return { status: 'DEDUPED' }
  }

  const dispatch = await prisma.pushDispatch.findUnique({
    where: { id: dispatchId },
    include: { notification: true },
  })
  if (!dispatch?.notification) {
    await prisma.pushDispatch.update({
      where: { id: dispatchId },
      data: { status: 'FAILED', lastError: 'Notification is missing' },
    })
    return { status: 'FAILED', error: 'Notification is missing' }
  }

  const tokens = await prisma.pushToken.findMany({
    where: { userId: dispatch.userId },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  })
  if (!tokens.length) {
    await prisma.pushDispatch.update({
      where: { id: dispatchId },
      data: {
        status: 'SKIPPED',
        tokenCount: 0,
        skippedReason: 'NO_TOKENS',
      },
    })
    console.info(`Push ${dispatch.dedupeKey} skipped: no registered tokens`)
    return { status: 'SKIPPED', skippedReason: 'NO_TOKENS' }
  }

  try {
    const result = await pushSender({
      tokens: tokens.map((item) => item.token),
      notification: {
        title: dispatch.notification.title.slice(0, 200),
        body: dispatch.notification.body.slice(0, 1000),
        ...(dispatch.notification.imageUrl
          ? { imageUrl: dispatch.notification.imageUrl }
          : {}),
      },
      data: stringData({
        notificationId: dispatch.notification.id,
        type: dispatch.notification.type,
        ...(dispatch.notification.data || {}),
      }),
    })

    if (!result.configured) {
      await prisma.pushDispatch.update({
        where: { id: dispatchId },
        data: {
          status: 'SKIPPED',
          tokenCount: tokens.length,
          skippedReason: result.skippedReason || 'NO_CREDENTIALS',
        },
      })
      console.info(
        `Push ${dispatch.dedupeKey} skipped: ${
          result.skippedReason || 'FCM is not configured'
        }`,
      )
      return {
        status: 'SKIPPED',
        skippedReason: result.skippedReason || 'NO_CREDENTIALS',
      }
    }

    const invalidTokenIds = []
    let sentCount = 0
    let failedCount = 0
    for (const [index, response] of result.responses.entries()) {
      if (response.success) {
        sentCount += 1
      } else {
        failedCount += 1
        if (INVALID_TOKEN_CODES.has(response.error?.code)) {
          invalidTokenIds.push(tokens[index].id)
        }
      }
    }
    if (invalidTokenIds.length) {
      await prisma.pushToken.deleteMany({
        where: { id: { in: invalidTokenIds } },
      })
    }

    const status = sentCount > 0 ? 'SENT' : 'FAILED'
    await prisma.pushDispatch.update({
      where: { id: dispatchId },
      data: {
        status,
        tokenCount: tokens.length,
        sentCount,
        failedCount,
        sentAt: sentCount > 0 ? new Date() : null,
        lastError:
          sentCount === 0 && failedCount > 0
            ? 'FCM rejected every registered token'
            : null,
      },
    })
    return { status, sentCount, failedCount, invalidTokenCount: invalidTokenIds.length }
  } catch (error) {
    await prisma.pushDispatch.update({
      where: { id: dispatchId },
      data: {
        status: 'FAILED',
        tokenCount: tokens.length,
        lastError: String(error.message || error).slice(0, 2000),
      },
    })
    console.error(`Push ${dispatch.dedupeKey} failed:`, error.message || error)
    return { status: 'FAILED', error: error.message || String(error) }
  }
}

export const queuePushDispatch = (dispatchId) => {
  dispatchScheduler(() => {
    dispatchPush(dispatchId).catch((error) => {
      console.error(`Push dispatch ${dispatchId} crashed:`, error)
    })
  })
}

export const createNotificationWithPush = async ({
  userId,
  type,
  title,
  body,
  imageUrl = null,
  clubId = null,
  newsId = null,
  dedupeKey,
  data = {},
  campaignId = null,
  queue = true,
}) => {
  const result = await prisma.$transaction(async (tx) => {
    const notification = await tx.userNotification.upsert({
      where: { dedupeKey },
      update: { title, body, imageUrl, clubId, newsId, data, campaignId },
      create: {
        userId,
        type,
        title,
        body,
        imageUrl,
        clubId,
        newsId,
        dedupeKey,
        data,
        campaignId,
      },
    })
    const dispatch = await tx.pushDispatch.upsert({
      where: { dedupeKey },
      update: { notificationId: notification.id, campaignId },
      create: {
        userId,
        notificationId: notification.id,
        dedupeKey,
        campaignId,
      },
    })
    return { notification, dispatch }
  })

  if (queue) queuePushDispatch(result.dispatch.id)
  return result
}

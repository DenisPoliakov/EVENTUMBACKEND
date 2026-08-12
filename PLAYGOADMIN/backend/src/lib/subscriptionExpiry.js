import { config } from '../config.js'
import prisma from '../prisma.js'
import { formatHumanDateRu } from './dates.js'
import { createNotificationWithPush } from './pushNotifications.js'

const addDays = (date, days) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000)

const expiryDedupeKey = (kind, subscription) =>
  `subscription-expiring:${kind}:${subscription.id}:${subscription.expiresAt.toISOString()}`

const notifySubscription = (kind, subscription, title) =>
  createNotificationWithPush({
    userId: subscription.userId,
    type: 'SUBSCRIPTION_EXPIRING',
    title: 'Подписка скоро закончится',
    body: `«${title}» действует до ${formatHumanDateRu(subscription.expiresAt)}. Не забудьте продлить, чтобы ничего не потерять.`,
    dedupeKey: expiryDedupeKey(kind, subscription),
    data: {
      subscriptionId: subscription.id,
      subscriptionKind: kind,
      expiresAt: subscription.expiresAt.toISOString(),
    },
  })

export const runSubscriptionExpiryNotifications = async ({
  now = new Date(),
  windowDays = config.pushExpiryWindowDays,
  batchSize = config.pushExpiryBatchSize,
} = {}) => {
  const expiresBefore = addDays(now, windowDays)
  const [memberships, premiumSubscriptions] = await Promise.all([
    prisma.userSubscription.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gt: now, lte: expiresBefore },
      },
      include: { plan: { select: { title: true } } },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: batchSize,
    }),
    prisma.appPremiumSubscription.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gt: now, lte: expiresBefore },
      },
      include: { plan: { select: { title: true } } },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: batchSize,
    }),
  ])

  await Promise.all([
    ...memberships.map((subscription) =>
      notifySubscription('MEMBERSHIP', subscription, subscription.plan.title),
    ),
    ...premiumSubscriptions.map((subscription) =>
      notifySubscription('PREMIUM', subscription, subscription.plan.title),
    ),
  ])

  return {
    processed: memberships.length + premiumSubscriptions.length,
    membershipCount: memberships.length,
    premiumCount: premiumSubscriptions.length,
    expiresBefore,
  }
}

export const startSubscriptionExpiryJob = () => {
  if (!config.pushExpiryIntervalMinutes) return null

  const run = () =>
    runSubscriptionExpiryNotifications().catch((error) => {
      console.error('Subscription expiry notification job failed:', error)
    })
  run()
  const timer = setInterval(
    run,
    config.pushExpiryIntervalMinutes * 60 * 1000,
  )
  timer.unref()
  return timer
}

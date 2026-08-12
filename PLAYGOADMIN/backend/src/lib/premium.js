import { config } from '../config.js'
import prisma from '../prisma.js'

export const getConfiguredPremiumPlan = (client = prisma) =>
  client.appPremiumPlan.upsert({
    where: { code: 'DEFAULT' },
    update: {
      priceCents: config.premiumPriceCents,
      currency: config.premiumCurrency,
      durationDays: config.premiumDurationDays,
    },
    create: {
      code: 'DEFAULT',
      title: 'EVENTUM Premium',
      priceCents: config.premiumPriceCents,
      currency: config.premiumCurrency,
      durationDays: config.premiumDurationDays,
    },
  })

export const findActivePremiumSubscription = (
  userId,
  client = prisma,
  now = new Date(),
) =>
  client.appPremiumSubscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: 'desc' },
  })

export const userHasActivePremium = async (
  userId,
  client = prisma,
  now = new Date(),
) => Boolean(await findActivePremiumSubscription(userId, client, now))

export const extendPremiumSubscription = async ({
  client,
  userId,
  planId,
  durationDays,
  amountCents,
  currency,
  now = new Date(),
}) => {
  const latest = await client.appPremiumSubscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { expiresAt: 'desc' },
  })
  const extensionBase = latest?.expiresAt > now ? latest.expiresAt : now
  const expiresAt = new Date(extensionBase)
  expiresAt.setUTCDate(expiresAt.getUTCDate() + durationDays)

  return client.appPremiumSubscription.create({
    data: {
      userId,
      planId,
      status: 'ACTIVE',
      startsAt: now,
      expiresAt,
      paidAt: now,
      amountCents,
      currency,
    },
  })
}

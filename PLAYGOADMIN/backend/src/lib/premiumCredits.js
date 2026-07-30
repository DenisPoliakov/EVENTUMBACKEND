import prisma from '../prisma.js'
import { orderInclude, requestFingerprint } from './orders.js'
import {
  extendPremiumSubscription,
  getConfiguredPremiumPlan,
} from './premium.js'

export class PremiumCreditError extends Error {
  constructor(message, statusCode, code, details = {}) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export const serializePremiumCreditTransaction = (transaction) => ({
  id: transaction.id,
  type: transaction.type,
  amountCents: transaction.amountCents,
  balanceAfterCents: transaction.balanceAfterCents,
  currency: transaction.currency,
  referralRedemptionId: transaction.referralRedemptionId || '',
  orderId: transaction.orderId || '',
  metadata: transaction.metadata || {},
  createdAt: transaction.createdAt,
})

export const getPremiumCreditSummary = async (userId, limit = 50) => {
  const account = await prisma.premiumCreditAccount.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 100),
      },
    },
  })

  return {
    balanceCents: account?.balanceCents || 0,
    earnedCents: account?.earnedCents || 0,
    spentCents: account?.spentCents || 0,
    currency: account?.currency || 'RUB',
    transactions: (account?.transactions || []).map(
      serializePremiumCreditTransaction,
    ),
  }
}

export const purchasePremiumWithCredits = async ({
  userId,
  idempotencyKey,
}) => {
  const normalizedKey = String(idempotencyKey || '').trim()
  if (!normalizedKey || normalizedKey.length > 200) {
    throw new PremiumCreditError(
      'Idempotency-Key header is required (max 200 characters)',
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
    )
  }

  const plan = await getConfiguredPremiumPlan()
  if (!plan.isActive) {
    throw new PremiumCreditError(
      'Premium plan is not active',
      409,
      'PREMIUM_PLAN_INACTIVE',
    )
  }
  const internalIdempotencyKey = `premium-credits:${normalizedKey}`
  const fingerprint = requestFingerprint({
    planId: `premium:${plan.id}`,
    clubId: null,
    type: 'PREMIUM',
  })

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`

    const existingOrder = await tx.order.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey: internalIdempotencyKey,
        },
      },
      include: orderInclude,
    })
    if (existingOrder) {
      if (
        existingOrder.requestFingerprint !== fingerprint ||
        existingOrder.type !== 'PREMIUM'
      ) {
        throw new PremiumCreditError(
          'Idempotency-Key was already used for another request',
          409,
          'IDEMPOTENCY_KEY_REUSED',
        )
      }
      const account = await tx.premiumCreditAccount.findUnique({
        where: { userId },
      })
      return { order: existingOrder, account, created: false }
    }

    await tx.premiumCreditAccount.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        currency: plan.currency,
      },
    })
    const spent = await tx.premiumCreditAccount.updateMany({
      where: {
        userId,
        currency: plan.currency,
        balanceCents: { gte: plan.priceCents },
      },
      data: {
        balanceCents: { decrement: plan.priceCents },
        spentCents: { increment: plan.priceCents },
      },
    })
    if (spent.count !== 1) {
      const account = await tx.premiumCreditAccount.findUnique({
        where: { userId },
      })
      throw new PremiumCreditError(
        'Not enough Premium credits',
        409,
        'INSUFFICIENT_PREMIUM_CREDITS',
        {
          balanceCents: account?.balanceCents || 0,
          requiredCents: plan.priceCents,
          currency: plan.currency,
        },
      )
    }

    const now = new Date()
    const order = await tx.order.create({
      data: {
        userId,
        premiumPlanId: plan.id,
        type: 'PREMIUM',
        status: 'PAID',
        amountCents: plan.priceCents,
        currency: plan.currency,
        durationDays: plan.durationDays,
        idempotencyKey: internalIdempotencyKey,
        requestFingerprint: fingerprint,
        paidAt: now,
      },
    })
    const subscription = await extendPremiumSubscription({
      client: tx,
      userId,
      planId: plan.id,
      durationDays: plan.durationDays,
      amountCents: plan.priceCents,
      currency: plan.currency,
      now,
    })
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { premiumSubscriptionId: subscription.id },
      include: orderInclude,
    })
    const account = await tx.premiumCreditAccount.findUnique({
      where: { userId },
    })
    await tx.premiumCreditTransaction.create({
      data: {
        userId,
        type: 'PREMIUM_PURCHASE',
        amountCents: -plan.priceCents,
        balanceAfterCents: account.balanceCents,
        currency: plan.currency,
        idempotencyKey: `premium-credit-purchase:${order.id}`,
        orderId: order.id,
        metadata: {
          planId: plan.id,
          durationDays: plan.durationDays,
        },
      },
    })

    return { order: updatedOrder, account, created: true }
  })
}

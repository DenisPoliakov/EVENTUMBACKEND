import crypto from 'crypto'

import { config } from '../config.js'
import prisma from '../prisma.js'
import {
  extendPremiumSubscription,
  getConfiguredPremiumPlan,
} from './premium.js'

const normalizeCode = (value) => String(value || '').trim().toUpperCase()

export const ensureReferralCode = async (userId, client = prisma) => {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })
  if (!user) return null
  if (user.referralCode) return user.referralCode

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase()
    try {
      const updated = await client.user.updateMany({
        where: { id: userId, referralCode: null },
        data: { referralCode: code },
      })
      if (updated.count === 1) return code
      const current = await client.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      })
      if (current?.referralCode) return current.referralCode
    } catch (error) {
      if (error.code !== 'P2002') throw error
      const current = await client.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      })
      if (current?.referralCode) return current.referralCode
    }
  }
  throw new Error('Could not allocate a unique referral code')
}

export const applyReferralCode = async (referredUserId, rawCode) => {
  const code = normalizeCode(rawCode)
  if (!code) return { status: 400, error: 'referralCode is required' }
  const ownCode = await ensureReferralCode(referredUserId)
  if (!ownCode) return { status: 401, error: 'Unauthorized' }
  if (ownCode === code) return { status: 400, error: 'You cannot apply your own referral code' }
  const plan =
    config.referredBonusPremiumDays > 0
      ? await getConfiguredPremiumPlan()
      : null

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${referredUserId} FOR UPDATE`

    const referred = await tx.user.findUnique({
      where: { id: referredUserId },
      select: { createdAt: true },
    })
    if (!referred) return { status: 401, error: 'Unauthorized' }
    const applyDeadline = new Date(
      referred.createdAt.getTime() + config.referralApplyWindowHours * 60 * 60 * 1000,
    )
    if (applyDeadline < new Date()) {
      return {
        status: 409,
        error: `Referral code can only be applied within ${config.referralApplyWindowHours} hours after registration`,
      }
    }

    const existing = await tx.referralRedemption.findUnique({
      where: { referredUserId },
    })
    if (existing) return { status: 409, error: 'A referral code was already applied' }

    const referrer = await tx.user.findFirst({
      where: { referralCode: { equals: code, mode: 'insensitive' } },
      select: {
        id: true,
        referralCode: true,
        isBlocked: true,
        blockedUntil: true,
      },
    })
    if (!referrer) return { status: 404, error: 'Referral code not found' }
    if (referrer.id === referredUserId) {
      return { status: 400, error: 'You cannot apply your own referral code' }
    }
    const referrerIsBlocked =
      referrer.isBlocked &&
      (!referrer.blockedUntil || referrer.blockedUntil > new Date())
    if (referrerIsBlocked) {
      return { status: 409, error: 'Referral code owner is blocked' }
    }

    let redemption = await tx.referralRedemption.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId,
        code: referrer.referralCode,
        referrerRewardCents: config.referralRewardCents,
        referredBonusDays: config.referredBonusPremiumDays,
      },
    })
    let referrerAccount = null
    if (config.referralRewardCents > 0) {
      referrerAccount = await tx.premiumCreditAccount.upsert({
        where: { userId: referrer.id },
        update: {
          balanceCents: { increment: config.referralRewardCents },
          earnedCents: { increment: config.referralRewardCents },
        },
        create: {
          userId: referrer.id,
          balanceCents: config.referralRewardCents,
          earnedCents: config.referralRewardCents,
          currency: config.premiumCurrency,
        },
      })
      await tx.premiumCreditTransaction.create({
        data: {
          userId: referrer.id,
          type: 'REFERRAL_REWARD',
          amountCents: config.referralRewardCents,
          balanceAfterCents: referrerAccount.balanceCents,
          currency: config.premiumCurrency,
          idempotencyKey: `referral-reward:${redemption.id}`,
          referralRedemptionId: redemption.id,
          metadata: {
            referredUserId,
            code: referrer.referralCode,
          },
        },
      })
    }

    let bonusSubscription = null
    if (plan && config.referredBonusPremiumDays > 0) {
      bonusSubscription = await extendPremiumSubscription({
        client: tx,
        userId: referredUserId,
        planId: plan.id,
        durationDays: config.referredBonusPremiumDays,
        amountCents: 0,
        currency: plan.currency,
      })
    }
    redemption = await tx.referralRedemption.update({
      where: { id: redemption.id },
      data: {
        rewardedAt: new Date(),
        bonusSubscriptionId: bonusSubscription?.id || null,
      },
    })

    return {
      status: 201,
      redemption,
      referrerAccount,
      bonusSubscription,
    }
  })
}

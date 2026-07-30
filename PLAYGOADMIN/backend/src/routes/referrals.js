import express from 'express'

import { config } from '../config.js'
import { applyReferralCode, ensureReferralCode } from '../lib/referrals.js'
import { requireAuth } from '../middleware/requireAuth.js'
import prisma from '../prisma.js'

const router = express.Router()

router.get('/me/referral', requireAuth, async (req, res, next) => {
  try {
    const referralCode = await ensureReferralCode(req.auth.sub)
    if (!referralCode) return res.status(401).json({ error: 'Unauthorized' })
    const [referralCount, redemption, account] = await Promise.all([
      prisma.referralRedemption.count({ where: { referrerUserId: req.auth.sub } }),
      prisma.referralRedemption.findUnique({
        where: { referredUserId: req.auth.sub },
        select: {
          code: true,
          createdAt: true,
          referredBonusDays: true,
          bonusSubscription: {
            select: { expiresAt: true },
          },
        },
      }),
      prisma.premiumCreditAccount.findUnique({
        where: { userId: req.auth.sub },
        select: {
          balanceCents: true,
          earnedCents: true,
          spentCents: true,
          currency: true,
        },
      }),
    ])
    res.json({
      referralCode,
      referralCount,
      appliedReferral: redemption || null,
      premiumCredits: {
        balanceCents: account?.balanceCents || 0,
        earnedCents: account?.earnedCents || 0,
        spentCents: account?.spentCents || 0,
        currency: account?.currency || config.premiumCurrency,
      },
      rewards: {
        referrerRewardCents: config.referralRewardCents,
        referredBonusPremiumDays: config.referredBonusPremiumDays,
        applyWindowHours: config.referralApplyWindowHours,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/me/referral/apply', requireAuth, async (req, res, next) => {
  try {
    const result = await applyReferralCode(
      req.auth.sub,
      req.body.referralCode ?? req.body.code,
    )
    if (result.error) return res.status(result.status).json({ error: result.error })
    res.status(result.status).json({
      ok: true,
      referralCode: result.redemption.code,
      appliedAt: result.redemption.createdAt,
      referredBonusPremiumDays: result.redemption.referredBonusDays,
      premiumExpiresAt: result.bonusSubscription?.expiresAt || null,
    })
  } catch (error) {
    next(error)
  }
})

export default router

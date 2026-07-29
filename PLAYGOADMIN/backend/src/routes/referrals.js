import express from 'express'

import { applyReferralCode, ensureReferralCode } from '../lib/referrals.js'
import { requireAuth } from '../middleware/requireAuth.js'
import prisma from '../prisma.js'

const router = express.Router()

router.get('/me/referral', requireAuth, async (req, res, next) => {
  try {
    const referralCode = await ensureReferralCode(req.auth.sub)
    if (!referralCode) return res.status(401).json({ error: 'Unauthorized' })
    const [referralCount, redemption] = await Promise.all([
      prisma.referralRedemption.count({ where: { referrerUserId: req.auth.sub } }),
      prisma.referralRedemption.findUnique({
        where: { referredUserId: req.auth.sub },
        select: { code: true, createdAt: true },
      }),
    ])
    res.json({
      referralCode,
      referralCount,
      appliedReferral: redemption || null,
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
    })
  } catch (error) {
    next(error)
  }
})

export default router

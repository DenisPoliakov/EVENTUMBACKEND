import express from 'express'

import { config } from '../config.js'
import prisma from '../prisma.js'

const router = express.Router()

router.get('/', async (_req, res, next) => {
  try {
    await prisma.appPremiumPlan.upsert({
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
    const [plans, subscriptions] = await Promise.all([
      prisma.appPremiumPlan.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.appPremiumSubscription.findMany({
        include: {
          plan: true,
          user: {
            select: { id: true, email: true, username: true, name: true },
          },
          order: {
            select: { id: true, status: true, paidAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ])
    res.json({ plans, subscriptions })
  } catch (error) {
    next(error)
  }
})

export default router

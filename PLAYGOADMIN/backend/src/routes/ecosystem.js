import express from 'express'
import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  clubInclude,
  planInclude,
  serializeClub,
  serializePlan,
  serializeSport,
  serializeSubscription,
  subscriptionInclude,
  toNullableInt,
} from '../lib/ecosystem.js'

const router = express.Router()

const daysFromNow = (days, start = new Date()) => {
  const result = new Date(start)
  result.setDate(result.getDate() + days)
  return result
}

router.get('/sports', async (_req, res, next) => {
  try {
    const sports = await prisma.sport.findMany({ orderBy: { name: 'asc' } })
    res.json(sports.map(serializeSport))
  } catch (err) {
    next(err)
  }
})

router.get('/clubs', async (req, res, next) => {
  try {
    const age = toNullableInt(req.query.age)
    const sportCode = String(req.query.sportCode || '').trim().toUpperCase()
    const city = String(req.query.city || '').trim()
    const clubs = await prisma.sportClub.findMany({
      where: {
        sportId: req.query.sportId || undefined,
        sport: sportCode ? { code: sportCode } : undefined,
        cityId: req.query.cityId || undefined,
        city: city ? { name: { equals: city, mode: 'insensitive' } } : undefined,
        AND:
          age == null
            ? undefined
            : [
                { OR: [{ minAge: null }, { minAge: { lte: age } }] },
                { OR: [{ maxAge: null }, { maxAge: { gte: age } }] },
              ],
      },
      orderBy: { name: 'asc' },
      include: clubInclude,
    })
    res.json(clubs.map(serializeClub))
  } catch (err) {
    next(err)
  }
})

router.get('/clubs/:id', async (req, res, next) => {
  try {
    const club = await prisma.sportClub.findUnique({
      where: { id: req.params.id },
      include: clubInclude,
    })
    if (!club) return res.status(404).json({ error: 'Club not found' })
    res.json(serializeClub(club))
  } catch (err) {
    next(err)
  }
})

router.get('/subscription-plans', async (req, res, next) => {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: {
        sportId: req.query.sportId || undefined,
        clubId: req.query.clubId || undefined,
        isActive: req.query.active === undefined ? true : String(req.query.active) === 'true',
      },
      orderBy: { priceCents: 'asc' },
      include: planInclude,
    })
    res.json(plans.map(serializePlan))
  } catch (err) {
    next(err)
  }
})

router.get('/me/subscriptions', requireAuth, async (req, res, next) => {
  try {
    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        userId: req.auth.sub,
        status: req.query.status || undefined,
      },
      orderBy: { expiresAt: 'desc' },
      include: subscriptionInclude,
    })
    res.json({ subscriptions: subscriptions.map(serializeSubscription) })
  } catch (err) {
    next(err)
  }
})

router.get('/me/subscriptions/notifications', requireAuth, async (req, res, next) => {
  try {
    const now = new Date()
    const soon = daysFromNow(7, now)
    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        userId: req.auth.sub,
        status: 'ACTIVE',
        expiresAt: { lte: soon, gte: now },
      },
      include: subscriptionInclude,
      orderBy: { expiresAt: 'asc' },
    })
    res.json({
      notifications: subscriptions.map((subscription) => ({
        type: 'SUBSCRIPTION_EXPIRING',
        title: 'Абонемент скоро закончится',
        body: `Абонемент "${subscription.plan.title}" действует до ${subscription.expiresAt.toISOString()}.`,
        subscription: serializeSubscription(subscription),
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/subscriptions', requireAuth, async (req, res, next) => {
  try {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: String(req.body.planId || '') },
      include: planInclude,
    })
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Subscription plan not found' })
    }

    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date()
    const subscription = await prisma.userSubscription.create({
      data: {
        userId: req.auth.sub,
        sportId: plan.sportId,
        clubId: plan.clubId,
        planId: plan.id,
        status: 'ACTIVE',
        startsAt,
        expiresAt: daysFromNow(plan.durationDays, startsAt),
        paidAt: new Date(),
        amountCents: plan.priceCents,
        currency: plan.currency,
      },
      include: subscriptionInclude,
    })

    res.status(201).json({
      subscription: serializeSubscription(subscription),
      notification: {
        type: 'PAYMENT_SUCCESS',
        title: 'Оплата прошла успешно',
        body: `Абонемент "${plan.title}" активирован.`,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router

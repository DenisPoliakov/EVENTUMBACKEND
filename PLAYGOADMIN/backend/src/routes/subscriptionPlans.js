import express from 'express'
import prisma from '../prisma.js'
import {
  normalizeClubTier,
  planInclude,
  serializePlan,
  toNullableInt,
} from '../lib/ecosystem.js'

const router = express.Router()

const buildWhere = (query) => ({
  sportId: query.sportId || undefined,
  clubId: query.clubId || undefined,
  tier: normalizeClubTier(query.tier, true) || undefined,
  isActive:
    query.active === undefined ? undefined : String(query.active).trim() === 'true',
})

const buildData = (body) => ({
  sportId: body.sportId,
  clubId: body.clubId || null,
  tier: normalizeClubTier(body.tier, true),
  title: String(body.title || '').trim(),
  description: String(body.description || '').trim() || null,
  priceCents: toNullableInt(body.priceCents),
  currency: String(body.currency || 'RUB').trim().toUpperCase(),
  durationDays: toNullableInt(body.durationDays),
  isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
})

router.get('/', async (req, res, next) => {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: buildWhere(req.query),
      orderBy: { createdAt: 'desc' },
      include: planInclude,
    })
    res.json(plans.map(serializePlan))
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const data = buildData(req.body)
    if (!data.sportId || !data.title || data.priceCents == null || !data.durationDays) {
      return res.status(400).json({ error: 'sportId, title, priceCents and durationDays are required' })
    }
    if (req.body.tier && !data.tier) {
      return res.status(400).json({ error: 'tier is invalid' })
    }
    const plan = await prisma.membershipPlan.create({
      data: {
        ...data,
        isActive: data.isActive ?? true,
      },
      include: planInclude,
    })
    res.status(201).json(serializePlan(plan))
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: req.params.id },
      include: planInclude,
    })
    if (!plan) return res.status(404).json({ error: 'Subscription plan not found' })
    res.json(serializePlan(plan))
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const data = buildData(req.body)
    if (req.body.tier && !data.tier) {
      return res.status(400).json({ error: 'tier is invalid' })
    }
    const plan = await prisma.membershipPlan.update({
      where: { id: req.params.id },
      data,
      include: planInclude,
    })
    res.json(serializePlan(plan))
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Subscription plan not found' })
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.membershipPlan.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Subscription plan not found' })
    next(err)
  }
})

export default router

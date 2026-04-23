import express from 'express'
import prisma from '../prisma.js'
import { serializeSubscription, subscriptionInclude } from '../lib/ecosystem.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        sportId: req.query.sportId || undefined,
        clubId: req.query.clubId || undefined,
        userId: req.query.userId || undefined,
        status: req.query.status || undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: subscriptionInclude,
    })
    res.json(subscriptions.map(serializeSubscription))
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body.status || '').trim().toUpperCase()
    if (!['ACTIVE', 'EXPIRED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE, EXPIRED or CANCELLED' })
    }
    const subscription = await prisma.userSubscription.update({
      where: { id: req.params.id },
      data: { status },
      include: subscriptionInclude,
    })
    res.json(serializeSubscription(subscription))
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Subscription not found' })
    next(err)
  }
})

export default router

import express from 'express'

import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  orderInclude,
  requestFingerprint,
  serializeOrder,
} from '../lib/orders.js'
import {
  createYooKassaPayment,
  PaymentsNotConfiguredError,
} from '../lib/yookassa.js'

const router = express.Router()

const normalizeType = (value) => {
  const type = String(value || 'MEMBERSHIP').trim().toUpperCase()
  return ['MEMBERSHIP', 'SUBSCRIPTION', 'PASS'].includes(type)
    ? 'MEMBERSHIP'
    : null
}

router.post('/me/orders', requireAuth, async (req, res, next) => {
  try {
    const planId = String(req.body.planId || req.body.passId || '').trim()
    const clubId = String(req.body.clubId || '').trim()
    const type = normalizeType(req.body.type)
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim()
    if (!planId) return res.status(400).json({ error: 'planId or passId is required' })
    if (!type) return res.status(400).json({ error: 'type must be MEMBERSHIP' })
    if (!idempotencyKey || idempotencyKey.length > 200) {
      return res.status(400).json({ error: 'Idempotency-Key header is required (max 200 characters)' })
    }

    const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Membership plan not found' })
    }
    if (clubId && clubId !== (plan.clubId || '')) {
      return res.status(400).json({ error: 'clubId does not match the selected plan' })
    }
    for (const [field, expected] of [
      ['priceCents', plan.priceCents],
      ['amountCents', plan.priceCents],
      ['currency', plan.currency],
      ['durationDays', plan.durationDays],
    ]) {
      if (req.body[field] !== undefined && String(req.body[field]) !== String(expected)) {
        return res.status(400).json({ error: `${field} is server-controlled and does not match the plan` })
      }
    }

    const fingerprint = requestFingerprint({
      planId,
      clubId: plan.clubId,
      type,
    })
    let order = await prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId: req.auth.sub, idempotencyKey } },
      include: orderInclude,
    })
    if (order && order.requestFingerprint !== fingerprint) {
      return res.status(409).json({ error: 'Idempotency-Key was already used for another request' })
    }
    const created = !order
    if (!order) {
      try {
        order = await prisma.order.create({
          data: {
            userId: req.auth.sub,
            planId: plan.id,
            clubId: plan.clubId,
            type,
            amountCents: plan.priceCents,
            currency: plan.currency.toUpperCase(),
            durationDays: plan.durationDays,
            idempotencyKey,
            requestFingerprint: fingerprint,
          },
          include: orderInclude,
        })
      } catch (error) {
        if (error.code !== 'P2002') throw error
        order = await prisma.order.findUnique({
          where: { userId_idempotencyKey: { userId: req.auth.sub, idempotencyKey } },
          include: orderInclude,
        })
        if (order.requestFingerprint !== fingerprint) {
          return res.status(409).json({ error: 'Idempotency-Key was already used for another request' })
        }
      }
    }
    if (order.status === 'PAID' || order.payment?.confirmationUrl) {
      return res.status(created ? 201 : 200).json(serializeOrder(order))
    }
    if (['CANCELLED', 'FAILED'].includes(order.status)) {
      return res.status(409).json({ error: `Order in terminal ${order.status} state cannot be paid` })
    }

    await prisma.payment.upsert({
      where: { orderId: order.id },
      update: {},
      create: {
        orderId: order.id,
        amountCents: order.amountCents,
        currency: order.currency,
      },
    })

    try {
      const providerPayment = await createYooKassaPayment(order)
      await prisma.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { status: 'PAYMENT_CREATED' },
      })
      await prisma.payment.update({
        where: { orderId: order.id },
        data: {
          externalId: providerPayment.id,
          status: 'PENDING',
          confirmationUrl: providerPayment.confirmation?.confirmation_url || null,
          providerPayload: providerPayment,
        },
      })
      order = await prisma.order.findUnique({ where: { id: order.id }, include: orderInclude })
      return res.status(created ? 201 : 200).json(serializeOrder(order))
    } catch (error) {
      if (error instanceof PaymentsNotConfiguredError) {
        order = await prisma.order.findUnique({ where: { id: order.id }, include: orderInclude })
        return res.status(503).json({
          error: error.message,
          code: error.code,
          order: serializeOrder(order),
        })
      }
      throw error
    }
  } catch (error) {
    next(error)
  }
})

router.post('/subscriptions', requireAuth, (_req, res) =>
  res.status(410).json({
    error: 'Direct subscription activation is disabled; create an order via POST /api/me/orders',
    code: 'DIRECT_SUBSCRIPTIONS_DISABLED',
  }),
)

export default router

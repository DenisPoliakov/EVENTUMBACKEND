import express from 'express'

import { config } from '../config.js'
import { orderInclude, requestFingerprint, serializeOrder } from '../lib/orders.js'
import { createYooKassaPayment, PaymentsNotConfiguredError } from '../lib/yookassa.js'
import { requireAuth } from '../middleware/requireAuth.js'
import prisma from '../prisma.js'

const router = express.Router()

const getConfiguredPlan = () =>
  prisma.appPremiumPlan.upsert({
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

router.get('/me/premium', requireAuth, async (req, res, next) => {
  try {
    const [plan, subscription] = await Promise.all([
      getConfiguredPlan(),
      prisma.appPremiumSubscription.findFirst({
        where: {
          userId: req.auth.sub,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        orderBy: { expiresAt: 'desc' },
      }),
    ])
    res.json({
      active: Boolean(subscription),
      expiresAt: subscription?.expiresAt || null,
      priceCents: plan.priceCents,
      currency: plan.currency,
      durationDays: plan.durationDays,
      planId: plan.id,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/me/premium', requireAuth, async (req, res, next) => {
  try {
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim()
    if (!idempotencyKey || idempotencyKey.length > 200) {
      return res.status(400).json({ error: 'Idempotency-Key header is required (max 200 characters)' })
    }
    const plan = await getConfiguredPlan()
    if (!plan.isActive) return res.status(409).json({ error: 'Premium plan is not active' })
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
      planId: `premium:${plan.id}`,
      clubId: null,
      type: 'PREMIUM',
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
            premiumPlanId: plan.id,
            type: 'PREMIUM',
            amountCents: plan.priceCents,
            currency: plan.currency,
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

export default router

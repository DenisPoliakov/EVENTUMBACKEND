import express from 'express'

import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { bookingInclude, serializeBooking } from '../lib/bookings.js'
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
  if (['MEMBERSHIP', 'SUBSCRIPTION', 'PASS', 'ABONEMENT'].includes(type)) {
    return 'MEMBERSHIP'
  }
  if (
    ['TRIAL', 'FREE_TRIAL', 'FREE', 'BOOKING', 'CLASS', 'LESSON', 'TRAINING'].includes(
      type,
    )
  ) {
    return 'TRIAL'
  }
  return null
}

const parseScheduledAt = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const localScheduleParts = (value) => {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
  )
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  const weekday =
    new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay() ||
    7
  return { weekday, time: `${hour}:${minute}` }
}

const createTrialBookingForOrder = async (tx, order) => {
  const existing = await tx.trainingBooking.findUnique({
    where: { orderId: order.id },
    include: bookingInclude,
  })
  if (existing) return existing

  return tx.trainingBooking.create({
    data: {
      userId: order.userId,
      clubId: order.clubId,
      scheduleEntryId: order.scheduleEntryId,
      scheduledAt: order.scheduledAt,
      scheduleTitle: order.scheduleEntry?.title || 'Пробное занятие',
      priceCents: order.amountCents,
      platformFeeCents: Math.round(order.amountCents * 0.15),
      currency: order.currency,
      status: 'CONFIRMED',
      orderId: order.id,
      coachProfileId: order.scheduleEntry?.coachProfileId || null,
    },
    include: bookingInclude,
  })
}

const completeFreeTrialOrder = async (orderId) =>
  prisma.$transaction(async (tx) => {
    const locked = await tx.order.updateMany({
      where: { id: orderId, status: { in: ['PENDING', 'PAYMENT_CREATED'] }, type: 'TRIAL' },
      data: { status: 'PAID', paidAt: new Date() },
    })
    if (locked.count === 0) {
      return tx.order.findUnique({
        where: { id: orderId },
        include: { ...orderInclude, scheduleEntry: true },
      })
    }
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { scheduleEntry: true },
    })
    await createTrialBookingForOrder(tx, order)
    return tx.order.findUnique({
      where: { id: orderId },
      include: {
        ...orderInclude,
        scheduleEntry: true,
        booking: { include: bookingInclude },
      },
    })
  })

router.post('/me/orders', requireAuth, async (req, res, next) => {
  try {
    const type = normalizeType(req.body.type)
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim()
    if (!type) {
      return res.status(400).json({
        error: 'type must be MEMBERSHIP or TRIAL',
        message:
          'Для абонемента передайте type=MEMBERSHIP, для пробного занятия — type=TRIAL вместе с scheduleEntryId и scheduledAt.',
      })
    }
    if (!idempotencyKey || idempotencyKey.length > 200) {
      return res.status(400).json({ error: 'Idempotency-Key header is required (max 200 characters)' })
    }

    if (type === 'TRIAL') {
      const scheduleEntryId = String(
        req.body.scheduleEntryId || req.body.scheduleId || '',
      ).trim()
      const scheduledAt = parseScheduledAt(req.body.scheduledAt)
      const planId = String(req.body.planId || req.body.passId || '').trim()

      if (!scheduleEntryId || !scheduledAt) {
        return res.status(400).json({
          error: 'trial requires scheduleEntryId and scheduledAt',
          message:
            planId
              ? 'Пробное занятие нельзя оформить как абонемент. Передайте слот расписания (scheduleEntryId) и дату (scheduledAt), а не passId/planId.'
              : 'Для пробного занятия нужны scheduleEntryId (или scheduleId) и scheduledAt.',
        })
      }
      if (scheduledAt <= new Date()) {
        return res.status(400).json({ error: 'scheduledAt must be in the future' })
      }

      const schedule = await prisma.clubSchedule.findUnique({
        where: { id: scheduleEntryId },
        include: { club: { select: { id: true, name: true } } },
      })
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule entry not found' })
      }

      const requestedClubId = String(req.body.clubId || '').trim()
      if (requestedClubId && requestedClubId !== schedule.clubId) {
        return res.status(400).json({ error: 'clubId does not match the schedule club' })
      }

      const scheduleParts = localScheduleParts(req.body.scheduledAt)
      if (
        scheduleParts &&
        schedule.dayOfWeek != null &&
        scheduleParts.weekday !== schedule.dayOfWeek
      ) {
        return res
          .status(400)
          .json({ error: 'scheduledAt does not match the schedule dayOfWeek' })
      }
      if (
        scheduleParts &&
        schedule.startTime &&
        scheduleParts.time !== schedule.startTime.slice(0, 5)
      ) {
        return res
          .status(400)
          .json({ error: 'scheduledAt does not match the schedule startTime' })
      }

      if (
        req.body.priceCents !== undefined &&
        Number(req.body.priceCents) !== schedule.priceCents
      ) {
        return res.status(400).json({
          error: 'priceCents does not match the server schedule price',
          priceCents: schedule.priceCents,
        })
      }

      const fingerprint = requestFingerprint({
        planId: null,
        clubId: schedule.clubId,
        type,
        scheduleEntryId: schedule.id,
        scheduledAt: scheduledAt.toISOString(),
      })

      let order = await prisma.order.findUnique({
        where: { userId_idempotencyKey: { userId: req.auth.sub, idempotencyKey } },
        include: {
          ...orderInclude,
          scheduleEntry: true,
          booking: { include: bookingInclude },
        },
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
              planId: null,
              clubId: schedule.clubId,
              scheduleEntryId: schedule.id,
              scheduledAt,
              type: 'TRIAL',
              amountCents: schedule.priceCents,
              currency: 'RUB',
              durationDays: 0,
              idempotencyKey,
              requestFingerprint: fingerprint,
            },
            include: {
              ...orderInclude,
              scheduleEntry: true,
              booking: { include: bookingInclude },
            },
          })
        } catch (error) {
          if (error.code !== 'P2002') throw error
          order = await prisma.order.findUnique({
            where: { userId_idempotencyKey: { userId: req.auth.sub, idempotencyKey } },
            include: {
              ...orderInclude,
              scheduleEntry: true,
              booking: { include: bookingInclude },
            },
          })
          if (order.requestFingerprint !== fingerprint) {
            return res.status(409).json({
              error: 'Idempotency-Key was already used for another request',
            })
          }
        }
      }

      if (order.status === 'PAID') {
        return res.status(created ? 201 : 200).json({
          ...serializeOrder(order),
          booking: order.booking ? serializeBooking(order.booking) : null,
          message: 'Пробное занятие оформлено',
        })
      }
      if (['CANCELLED', 'FAILED'].includes(order.status)) {
        return res.status(409).json({ error: `Order in terminal ${order.status} state cannot be paid` })
      }

      // Бесплатное пробное — сразу бронь, без абонемента и без ЮKassa.
      if (order.amountCents === 0) {
        order = await completeFreeTrialOrder(order.id)
        return res.status(created ? 201 : 200).json({
          ...serializeOrder(order),
          booking: order.booking ? serializeBooking(order.booking) : null,
          message: 'Бесплатное пробное занятие записано',
        })
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
        order = await prisma.order.findUnique({
          where: { id: order.id },
          include: {
            ...orderInclude,
            scheduleEntry: true,
            booking: { include: bookingInclude },
          },
        })
        return res.status(created ? 201 : 200).json({
          ...serializeOrder(order),
          booking: null,
          message: 'Оплатите пробное занятие — абонемент не создаётся',
        })
      } catch (error) {
        if (error instanceof PaymentsNotConfiguredError) {
          order = await prisma.order.findUnique({
            where: { id: order.id },
            include: {
              ...orderInclude,
              scheduleEntry: true,
              booking: { include: bookingInclude },
            },
          })
          return res.status(503).json({
            error: error.message,
            code: error.code,
            order: serializeOrder(order),
          })
        }
        throw error
      }
    }

    const planId = String(req.body.planId || req.body.passId || '').trim()
    const clubId = String(req.body.clubId || '').trim()
    if (!planId) return res.status(400).json({ error: 'planId or passId is required' })

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

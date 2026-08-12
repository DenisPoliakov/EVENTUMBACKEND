import crypto from 'crypto'

import prisma from '../prisma.js'
import { subscriptionInclude, serializeSubscription } from './ecosystem.js'

export const orderInclude = {
  user: { select: { id: true, email: true, username: true, name: true } },
  plan: { select: { id: true, title: true, sportId: true } },
  premiumPlan: { select: { id: true, code: true, title: true } },
  club: { select: { id: true, name: true } },
  scheduleEntry: {
    select: {
      id: true,
      title: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      priceCents: true,
      coachProfileId: true,
    },
  },
  payment: true,
  subscription: { include: subscriptionInclude },
  premiumSubscription: { include: { plan: true } },
  booking: true,
}

export const requestFingerprint = ({
  planId,
  clubId,
  type,
  scheduleEntryId = null,
  scheduledAt = null,
}) =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        planId: planId || null,
        clubId: clubId || null,
        type,
        scheduleEntryId: scheduleEntryId || null,
        scheduledAt: scheduledAt || null,
      }),
    )
    .digest('hex')

export const serializePayment = (payment) =>
  payment
    ? {
        id: payment.id,
        orderId: payment.orderId,
        provider: payment.provider,
        externalId: payment.externalId || '',
        status: payment.status,
        amountCents: payment.amountCents,
        currency: payment.currency,
        confirmationUrl: payment.confirmationUrl || '',
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      }
    : null

export const serializeOrder = (order) => ({
  id: order.id,
  userId: order.userId,
  user: order.user || null,
  planId: order.planId,
  passId: order.planId || '',
  plan: order.plan || null,
  premiumPlanId: order.premiumPlanId || '',
  premiumPlan: order.premiumPlan || null,
  clubId: order.clubId || '',
  club: order.club || null,
  scheduleEntryId: order.scheduleEntryId || '',
  scheduleId: order.scheduleEntryId || '',
  scheduledAt: order.scheduledAt || null,
  type: order.type,
  status: order.status,
  amountCents: order.amountCents,
  currency: order.currency,
  durationDays: order.durationDays,
  idempotencyKey: order.idempotencyKey,
  confirmationUrl: order.payment?.confirmationUrl || '',
  payment: serializePayment(order.payment),
  subscriptionId: order.subscriptionId || '',
  subscription: order.subscription
    ? serializeSubscription(order.subscription)
    : null,
  premiumSubscriptionId: order.premiumSubscriptionId || '',
  premiumSubscription: order.premiumSubscription || null,
  bookingId: order.booking?.id || '',
  paidAt: order.paidAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
})

export const activatePaidOrder = async (orderId, providerPayment) =>
  prisma.$transaction(async (tx) => {
    const pendingOrder = await tx.order.findUnique({
      where: { id: orderId },
      select: { type: true, userId: true },
    })
    if (pendingOrder?.type === 'PREMIUM') {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${pendingOrder.userId} FOR UPDATE`
    }
    const locked = await tx.order.updateMany({
      where: { id: orderId, status: { in: ['PENDING', 'PAYMENT_CREATED'] } },
      data: { status: 'PAID', paidAt: new Date() },
    })

    if (locked.count === 0) {
      return tx.order.findUnique({ where: { id: orderId }, include: orderInclude })
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    })
    const startsAt = new Date()
    if (order.type === 'PREMIUM') {
      const latest = await tx.appPremiumSubscription.findFirst({
        where: { userId: order.userId, status: 'ACTIVE' },
        orderBy: { expiresAt: 'desc' },
      })
      const extensionBase = latest?.expiresAt > startsAt ? latest.expiresAt : startsAt
      const expiresAt = new Date(extensionBase)
      expiresAt.setUTCDate(expiresAt.getUTCDate() + order.durationDays)
      const subscription = await tx.appPremiumSubscription.create({
        data: {
          userId: order.userId,
          planId: order.premiumPlanId,
          status: 'ACTIVE',
          startsAt,
          expiresAt,
          paidAt: startsAt,
          amountCents: order.amountCents,
          currency: order.currency,
        },
      })
      await tx.payment.update({
        where: { orderId },
        data: {
          externalId: providerPayment.id,
          status: 'SUCCEEDED',
          paidAt: startsAt,
          providerPayload: providerPayment,
        },
      })
      return tx.order.update({
        where: { id: orderId },
        data: { premiumSubscriptionId: subscription.id },
        include: orderInclude,
      })
    }

    if (order.type === 'TRIAL') {
      const fullOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { scheduleEntry: true },
      })
      const existingBooking = await tx.trainingBooking.findUnique({
        where: { orderId },
      })
      if (!existingBooking) {
        await tx.trainingBooking.create({
          data: {
            userId: fullOrder.userId,
            clubId: fullOrder.clubId,
            scheduleEntryId: fullOrder.scheduleEntryId,
            scheduledAt: fullOrder.scheduledAt,
            scheduleTitle: fullOrder.scheduleEntry?.title || 'Пробное занятие',
            priceCents: fullOrder.amountCents,
            platformFeeCents: Math.round(fullOrder.amountCents * 0.15),
            currency: fullOrder.currency,
            status: 'CONFIRMED',
            orderId: fullOrder.id,
            coachProfileId: fullOrder.scheduleEntry?.coachProfileId || null,
          },
        })
      }
      await tx.payment.update({
        where: { orderId },
        data: {
          externalId: providerPayment.id,
          status: 'SUCCEEDED',
          paidAt: startsAt,
          providerPayload: providerPayment,
        },
      })
      return tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      })
    }

    const expiresAt = new Date(startsAt)
    expiresAt.setUTCDate(expiresAt.getUTCDate() + order.durationDays)
    const subscription = await tx.userSubscription.create({
      data: {
        userId: order.userId,
        sportId: order.planId
          ? (await tx.membershipPlan.findUnique({
              where: { id: order.planId },
              select: { sportId: true },
            })).sportId
          : undefined,
        clubId: order.clubId,
        planId: order.planId,
        status: 'ACTIVE',
        startsAt,
        expiresAt,
        paidAt: startsAt,
        amountCents: order.amountCents,
        currency: order.currency,
      },
    })
    await tx.payment.update({
      where: { orderId },
      data: {
        externalId: providerPayment.id,
        status: 'SUCCEEDED',
        paidAt: startsAt,
        providerPayload: providerPayment,
      },
    })
    return tx.order.update({
      where: { id: orderId },
      data: { subscriptionId: subscription.id },
      include: orderInclude,
    })
  })

import express from 'express'

import {
  BOOKING_STATUSES,
  bookingInclude,
  serializeBooking,
} from '../lib/bookings.js'
import { createNotificationWithPush } from '../lib/pushNotifications.js'
import prisma from '../prisma.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim().toUpperCase()
    if (status && !BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status is invalid' })
    }

    const bookings = await prisma.trainingBooking.findMany({
      where: {
        status: status || undefined,
        clubId: req.query.clubId || undefined,
        userId: req.query.userId || undefined,
      },
      include: bookingInclude,
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
    })
    res.json(bookings.map(serializeBooking))
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body.status || '').trim().toUpperCase()
    if (!BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status is invalid' })
    }

    const existing = await prisma.trainingBooking.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' })
    }

    const booking = await prisma.trainingBooking.update({
      where: { id: req.params.id },
      data: { status },
      include: bookingInclude,
    })
    if (status === 'CONFIRMED' && existing.status !== 'CONFIRMED') {
      await createNotificationWithPush({
        userId: booking.userId,
        type: 'BOOKING_CONFIRMED',
        title: 'Запись подтверждена',
        body: `${booking.scheduleTitle} — ${booking.scheduledAt.toISOString()}`,
        dedupeKey: `booking-confirmed:${booking.id}`,
        data: { bookingId: booking.id, clubId: booking.clubId },
      })
    }
    res.json(serializeBooking(booking))
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Booking not found' })
    }
    next(err)
  }
})

export default router

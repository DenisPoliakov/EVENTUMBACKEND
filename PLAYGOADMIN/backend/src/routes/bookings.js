import express from 'express'

import {
  BOOKING_STATUSES,
  bookingInclude,
  hasActiveUserBlock,
  serializeBooking,
} from '../lib/bookings.js'
import { requireAuth } from '../middleware/requireAuth.js'
import prisma from '../prisma.js'

const router = express.Router()

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

router.get('/me/bookings', requireAuth, async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim().toUpperCase()
    if (status && !BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status is invalid' })
    }
    const bookings = await prisma.trainingBooking.findMany({
      where: {
        userId: req.auth.sub,
        status: status || undefined,
        clubId: req.query.clubId || undefined,
      },
      include: bookingInclude,
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
    })
    res.json(bookings.map(serializeBooking))
  } catch (err) {
    next(err)
  }
})

router.post('/me/bookings', requireAuth, async (req, res, next) => {
  try {
    const scheduleEntryId = String(
      req.body.scheduleEntryId || req.body.scheduleId || '',
    ).trim()
    if (!scheduleEntryId) {
      return res.status(400).json({ error: 'scheduleEntryId is required' })
    }

    const [user, schedule] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.auth.sub },
        select: {
          id: true,
          isBlocked: true,
          blockedUntil: true,
          blockReason: true,
        },
      }),
      prisma.clubSchedule.findUnique({
        where: { id: scheduleEntryId },
        include: {
          club: { select: { id: true, name: true } },
          coachProfile: { select: { id: true, userId: true } },
        },
      }),
    ])

    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (hasActiveUserBlock(user)) {
      return res.status(403).json({
        error: 'User is blocked on the platform',
        reason: user.blockReason || '',
        blockedUntil: user.blockedUntil,
      })
    }
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule entry not found' })
    }

    const requestedClubId = String(req.body.clubId || '').trim()
    if (requestedClubId && requestedClubId !== schedule.clubId) {
      return res
        .status(400)
        .json({ error: 'Schedule entry does not belong to clubId' })
    }

    const scheduledAt = parseScheduledAt(req.body.scheduledAt)
    if (!scheduledAt) {
      return res.status(400).json({ error: 'scheduledAt must be a valid ISO date' })
    }
    if (scheduledAt <= new Date()) {
      return res.status(400).json({ error: 'scheduledAt must be in the future' })
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

    const requestedCoachId = String(
      req.body.coachProfileId || req.body.coachId || '',
    ).trim()
    let coachProfileId = schedule.coachProfileId
    if (requestedCoachId && schedule.coachProfile) {
      if (
        requestedCoachId !== schedule.coachProfile.id &&
        requestedCoachId !== schedule.coachProfile.userId
      ) {
        return res
          .status(400)
          .json({ error: 'coachId does not match the schedule coach' })
      }
    } else if (requestedCoachId) {
      const coach = await prisma.coachProfile.findFirst({
        where: {
          clubId: schedule.clubId,
          OR: [{ id: requestedCoachId }, { userId: requestedCoachId }],
        },
        select: { id: true },
      })
      if (!coach) {
        return res
          .status(400)
          .json({ error: 'coachId does not belong to the schedule club' })
      }
      coachProfileId = coach.id
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

    const booking = await prisma.trainingBooking.create({
      data: {
        userId: user.id,
        clubId: schedule.clubId,
        scheduleEntryId: schedule.id,
        coachProfileId,
        scheduledAt,
        scheduleTitle:
          schedule.title || String(req.body.scheduleTitle || '').trim() || 'Training',
        note: String(req.body.note || '').trim() || null,
        priceCents: schedule.priceCents,
        platformFeeCents: Math.round(schedule.priceCents * 0.15),
        currency: 'RUB',
        status: 'PENDING',
      },
      include: bookingInclude,
    })

    res.status(201).json(serializeBooking(booking))
  } catch (err) {
    next(err)
  }
})

export default router

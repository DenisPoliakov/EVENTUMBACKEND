import express from 'express'

import prisma from '../prisma.js'
import { serializeClubLinkRequest } from './coachProfiles.js'

const router = express.Router()

const requestInclude = {
  club: {
    select: {
      id: true,
      name: true,
      address: true,
      city: { select: { id: true, name: true } },
      sport: { select: { id: true, code: true, name: true } },
    },
  },
  coachProfile: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userId: true,
      clubId: true,
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          phone: true,
        },
      },
    },
  },
}

const serializeAdminRequest = (request) => ({
  ...serializeClubLinkRequest(request),
  coachUser: request.coachProfile?.user
    ? {
        id: request.coachProfile.user.id,
        email: request.coachProfile.user.email,
        username: request.coachProfile.user.username || '',
        phone: request.coachProfile.user.phone || '',
      }
    : null,
})

router.get('/', async (req, res, next) => {
  try {
    const status = String(req.query.status || 'PENDING').trim().toUpperCase()
    const where =
      status && status !== 'ALL'
        ? { status }
        : undefined
    const requests = await prisma.coachClubLinkRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    res.json(requests.map(serializeAdminRequest))
  } catch (err) {
    next(err)
  }
})

router.post('/:id/approve', async (req, res, next) => {
  try {
    const existing = await prisma.coachClubLinkRequest.findUnique({
      where: { id: req.params.id },
      include: requestInclude,
    })
    if (!existing) return res.status(404).json({ error: 'Request not found' })
    if (existing.status !== 'PENDING') {
      return res.status(409).json({ error: 'Request is not pending' })
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.coachProfile.update({
        where: { id: existing.coachProfileId },
        data: { clubId: existing.clubId },
      })
      await tx.coachClubLinkRequest.updateMany({
        where: {
          coachProfileId: existing.coachProfileId,
          status: 'PENDING',
          id: { not: existing.id },
        },
        data: { status: 'CANCELLED', reviewedAt: new Date() },
      })
      return tx.coachClubLinkRequest.update({
        where: { id: existing.id },
        data: { status: 'APPROVED', reviewedAt: new Date() },
        include: requestInclude,
      })
    })

    res.json(serializeAdminRequest(updated))
  } catch (err) {
    next(err)
  }
})

router.post('/:id/reject', async (req, res, next) => {
  try {
    const existing = await prisma.coachClubLinkRequest.findUnique({
      where: { id: req.params.id },
      include: requestInclude,
    })
    if (!existing) return res.status(404).json({ error: 'Request not found' })
    if (existing.status !== 'PENDING') {
      return res.status(409).json({ error: 'Request is not pending' })
    }

    const updated = await prisma.coachClubLinkRequest.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        note:
          String(req.body.note || '').trim() ||
          existing.note ||
          null,
      },
      include: requestInclude,
    })
    res.json(serializeAdminRequest(updated))
  } catch (err) {
    next(err)
  }
})

export default router

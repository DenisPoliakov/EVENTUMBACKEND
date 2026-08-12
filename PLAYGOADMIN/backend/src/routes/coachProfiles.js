import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { coachProfileInclude, serializeCoachProfile, toNullableInt } from '../lib/ecosystem.js'

const router = express.Router()

const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'coaches')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `${unique}${ext}`)
  },
})

const upload = multer({ storage })

const clubLinkRequestInclude = {
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
    },
  },
}

export const serializeClubLinkRequest = (request) => ({
  id: request.id,
  status: request.status,
  note: request.note || '',
  clubId: request.clubId,
  club: request.club
    ? {
        id: request.club.id,
        name: request.club.name,
        address: request.club.address || '',
        city: request.club.city?.name || '',
        sport: request.club.sport || null,
      }
    : null,
  coachProfileId: request.coachProfileId,
  coachProfile: request.coachProfile
    ? {
        id: request.coachProfile.id,
        userId: request.coachProfile.userId,
        firstName: request.coachProfile.firstName,
        lastName: request.coachProfile.lastName,
        clubId: request.coachProfile.clubId || '',
      }
    : null,
  reviewedAt: request.reviewedAt,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
})

const buildPayload = (body) => ({
  firstName: String(body.firstName || '').trim(),
  lastName: String(body.lastName || '').trim(),
  phone: String(body.phone || '').trim(),
  experienceYears: toNullableInt(body.experienceYears),
  description:
    String(body.description || '').trim() ||
    String(body.achievements || '').trim() ||
    null,
  photoUrl: String(body.photoUrl || '').trim() || null,
  maxUrl: String(body.maxUrl || '').trim() || null,
  telegramUrl: String(body.telegramUrl || '').trim() || null,
})

router.get('/me/coach-profile', requireAuth, async (req, res, next) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.auth.sub },
      include: coachProfileInclude,
    })

    res.json({
      coachProfile: coachProfile ? serializeCoachProfile(coachProfile) : null,
    })
  } catch (err) {
    next(err)
  }
})

router.put('/me/coach-profile', requireAuth, async (req, res, next) => {
  try {
    const payload = buildPayload(req.body)
    if (!payload.firstName || !payload.lastName) {
      return res.status(400).json({ error: 'firstName and lastName are required' })
    }

    const requestedClubId = String(req.body.clubId || '').trim()
    const existing = await prisma.coachProfile.findUnique({
      where: { userId: req.auth.sub },
      select: { clubId: true },
    })
    if (
      Object.hasOwn(req.body, 'clubId') &&
      requestedClubId !== (existing?.clubId || '')
    ) {
      return res.status(403).json({
        error: 'Club link requires approval',
        message:
          'Нельзя самостоятельно привязать карточку к клубу. Отправьте заявку: POST /api/me/coach-profile/club-link-requests',
        code: 'COACH_CLUB_LINK_REQUIRES_REQUEST',
      })
    }

    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } })
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    const resolvedPhone = payload.phone || user.phone || ''
    if (!resolvedPhone) {
      return res.status(400).json({ error: 'phone is required for coach profile' })
    }

    const coachProfile = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { phone: resolvedPhone },
      })

      return tx.coachProfile.upsert({
        where: { userId: user.id },
        update: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          experienceYears: payload.experienceYears,
          description: payload.description,
          achievements: payload.description,
          photoUrl: payload.photoUrl,
          maxUrl: payload.maxUrl,
          telegramUrl: payload.telegramUrl,
        },
        create: {
          userId: user.id,
          clubId: null,
          firstName: payload.firstName,
          lastName: payload.lastName,
          experienceYears: payload.experienceYears,
          description: payload.description,
          achievements: payload.description,
          photoUrl: payload.photoUrl,
          maxUrl: payload.maxUrl,
          telegramUrl: payload.telegramUrl,
        },
        include: coachProfileInclude,
      })
    })

    res.json({ coachProfile: serializeCoachProfile(coachProfile) })
  } catch (err) {
    next(err)
  }
})

router.get('/me/coach-profile/club-link-requests', requireAuth, async (req, res, next) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.auth.sub },
      select: { id: true },
    })
    if (!coachProfile) {
      return res.status(404).json({ error: 'Coach profile not found' })
    }

    const requests = await prisma.coachClubLinkRequest.findMany({
      where: { coachProfileId: coachProfile.id },
      include: clubLinkRequestInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ requests: requests.map(serializeClubLinkRequest) })
  } catch (err) {
    next(err)
  }
})

router.post('/me/coach-profile/club-link-requests', requireAuth, async (req, res, next) => {
  try {
    const clubId = String(req.body.clubId || '').trim()
    if (!clubId) return res.status(400).json({ error: 'clubId is required' })

    const [coachProfile, club] = await Promise.all([
      prisma.coachProfile.findUnique({ where: { userId: req.auth.sub } }),
      prisma.sportClub.findUnique({
        where: { id: clubId },
        select: { id: true, name: true },
      }),
    ])
    if (!coachProfile) {
      return res.status(404).json({
        error: 'Coach profile not found',
        message: 'Сначала создайте тренерскую карточку через PUT /api/me/coach-profile',
      })
    }
    if (!club) return res.status(404).json({ error: 'Club not found' })
    if (coachProfile.clubId === club.id) {
      return res.status(409).json({ error: 'Coach is already linked to this club' })
    }

    const pending = await prisma.coachClubLinkRequest.findFirst({
      where: {
        coachProfileId: coachProfile.id,
        status: 'PENDING',
      },
    })
    if (pending) {
      return res.status(409).json({
        error: 'Pending club link request already exists',
        requestId: pending.id,
        message: 'Дождитесь решения по текущей заявке или отмените её.',
      })
    }

    const request = await prisma.coachClubLinkRequest.create({
      data: {
        coachProfileId: coachProfile.id,
        clubId: club.id,
        note: String(req.body.note || '').trim() || null,
        status: 'PENDING',
      },
      include: clubLinkRequestInclude,
    })
    res.status(201).json({ request: serializeClubLinkRequest(request) })
  } catch (err) {
    next(err)
  }
})

router.post(
  '/me/coach-profile/club-link-requests/:id/cancel',
  requireAuth,
  async (req, res, next) => {
    try {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: req.auth.sub },
        select: { id: true },
      })
      if (!coachProfile) {
        return res.status(404).json({ error: 'Coach profile not found' })
      }

      const existing = await prisma.coachClubLinkRequest.findFirst({
        where: {
          id: req.params.id,
          coachProfileId: coachProfile.id,
          status: 'PENDING',
        },
      })
      if (!existing) {
        return res.status(404).json({ error: 'Pending request not found' })
      }

      const request = await prisma.coachClubLinkRequest.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED', reviewedAt: new Date() },
        include: clubLinkRequestInclude,
      })
      res.json({ request: serializeClubLinkRequest(request) })
    } catch (err) {
      next(err)
    }
  },
)

router.post('/me/coach-profile/photo', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const url = `/uploads/coaches/${req.file.filename}`
    res.status(201).json({ url })
  } catch (err) {
    next(err)
  }
})

export default router

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

const buildPayload = (body) => ({
  clubId: String(body.clubId || '').trim(),
  firstName: String(body.firstName || '').trim(),
  lastName: String(body.lastName || '').trim(),
  phone: String(body.phone || '').trim(),
  experienceYears: toNullableInt(body.experienceYears),
  achievements: String(body.achievements || '').trim() || null,
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
    if (!payload.clubId || !payload.firstName || !payload.lastName) {
      return res.status(400).json({ error: 'clubId, firstName and lastName are required' })
    }

    const club = await prisma.sportClub.findUnique({ where: { id: payload.clubId } })
    if (!club) return res.status(404).json({ error: 'Club not found' })

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
          clubId: payload.clubId,
          firstName: payload.firstName,
          lastName: payload.lastName,
          experienceYears: payload.experienceYears,
          achievements: payload.achievements,
          photoUrl: payload.photoUrl,
          maxUrl: payload.maxUrl,
          telegramUrl: payload.telegramUrl,
        },
        create: {
          userId: user.id,
          clubId: payload.clubId,
          firstName: payload.firstName,
          lastName: payload.lastName,
          experienceYears: payload.experienceYears,
          achievements: payload.achievements,
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

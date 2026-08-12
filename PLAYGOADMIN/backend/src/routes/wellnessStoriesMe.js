import express from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'

import { userHasActivePremium } from '../lib/premium.js'
import {
  serializeWellnessStory,
  validateWellnessStoryPayload,
  wellnessStoryCountInclude,
} from '../lib/wellnessStories.js'
import { requireAuth } from '../middleware/requireAuth.js'
import prisma from '../prisma.js'

const router = express.Router()
const uploadDir = path.join(
  process.cwd(),
  'public',
  'uploads',
  'wellness-stories',
)
fs.mkdirSync(uploadDir, { recursive: true })

const imageExtensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${imageExtensions.get(file.mimetype) || '.jpg'}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!imageExtensions.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'))
    }
    cb(null, true)
  },
})

const uploadCover = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image must not exceed 5 MB' })
    }
    return res.status(400).json({ error: err.message || 'Invalid image' })
  })
}

const removeUploadedFile = (url) => {
  if (!url || !url.startsWith('/uploads/wellness-stories/')) return
  const filePath = path.join(uploadDir, path.basename(url))
  fs.promises.unlink(filePath).catch(() => {})
}

const serializeOwned = (story) =>
  serializeWellnessStory(story, { includeAdminFields: true })

const loadCoachPublisher = async (userId) => {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
  })
  if (!coachProfile) {
    const error = new Error('Coach profile is required to publish stories')
    error.statusCode = 403
    throw error
  }
  const hasPremium = await userHasActivePremium(userId)
  if (!hasPremium) {
    const error = new Error('Active Premium subscription is required to publish stories')
    error.statusCode = 403
    throw error
  }
  return coachProfile
}

const handleOwnedError = (err, res, next) => {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
  if (err.code === 'P2002' && err.meta?.target?.includes('slug')) {
    return res.status(409).json({ error: 'slug is already in use' })
  }
  return next(err)
}

router.get('/me/wellness-stories', requireAuth, async (req, res, next) => {
  try {
    await loadCoachPublisher(req.auth.sub)
    const stories = await prisma.wellnessStory.findMany({
      where: {
        authorUserId: req.auth.sub,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      include: wellnessStoryCountInclude,
    })
    res.json({ stories: stories.map(serializeOwned) })
  } catch (err) {
    handleOwnedError(err, res, next)
  }
})

router.post('/me/wellness-stories', requireAuth, async (req, res, next) => {
  try {
    const coachProfile = await loadCoachPublisher(req.auth.sub)
    const parsed = validateWellnessStoryPayload(req.body)
    if (parsed.error) return res.status(400).json({ error: parsed.error })

    const asClub = Boolean(req.body.asClub) && Boolean(coachProfile.clubId)
    if (Boolean(req.body.asClub) && !coachProfile.clubId) {
      return res.status(400).json({
        error: 'Coach is not linked to a club',
        message: 'Чтобы публиковать от имени клуба, привяжите профиль тренера к клубу.',
      })
    }

    const story = await prisma.wellnessStory.create({
      data: {
        ...parsed.data,
        authorType: asClub ? 'CLUB' : 'COACH',
        authorUserId: req.auth.sub,
        authorClubId: asClub ? coachProfile.clubId : null,
        coachProfileId: coachProfile.id,
        isActive:
          typeof parsed.data.isActive === 'boolean' ? parsed.data.isActive : true,
      },
      include: wellnessStoryCountInclude,
    })
    res.status(201).json(serializeOwned(story))
  } catch (err) {
    handleOwnedError(err, res, next)
  }
})

router.put('/me/wellness-stories/:id', requireAuth, async (req, res, next) => {
  try {
    await loadCoachPublisher(req.auth.sub)
    const existing = await prisma.wellnessStory.findFirst({
      where: {
        id: req.params.id,
        authorUserId: req.auth.sub,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Wellness story not found' })
    }

    const parsed = validateWellnessStoryPayload(req.body, { partial: true })
    if (parsed.error) return res.status(400).json({ error: parsed.error })

    const story = await prisma.wellnessStory.update({
      where: { id: existing.id },
      data: parsed.data,
      include: wellnessStoryCountInclude,
    })
    res.json(serializeOwned(story))
  } catch (err) {
    handleOwnedError(err, res, next)
  }
})

router.delete('/me/wellness-stories/:id', requireAuth, async (req, res, next) => {
  try {
    await loadCoachPublisher(req.auth.sub)
    const result = await prisma.wellnessStory.updateMany({
      where: {
        id: req.params.id,
        authorUserId: req.auth.sub,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    })
    if (result.count === 0) {
      return res.status(404).json({ error: 'Wellness story not found' })
    }
    res.status(204).send()
  } catch (err) {
    handleOwnedError(err, res, next)
  }
})

router.post(
  '/me/wellness-stories/:id/cover',
  requireAuth,
  uploadCover,
  async (req, res, next) => {
    const newUrl = req.file
      ? `/uploads/wellness-stories/${req.file.filename}`
      : null
    try {
      await loadCoachPublisher(req.auth.sub)
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }
      const existing = await prisma.wellnessStory.findFirst({
        where: {
          id: req.params.id,
          authorUserId: req.auth.sub,
          deletedAt: null,
        },
        select: { id: true, coverImageUrl: true },
      })
      if (!existing) {
        removeUploadedFile(newUrl)
        return res.status(404).json({ error: 'Wellness story not found' })
      }
      const story = await prisma.wellnessStory.update({
        where: { id: existing.id },
        data: { coverImageUrl: newUrl },
        include: wellnessStoryCountInclude,
      })
      removeUploadedFile(existing.coverImageUrl)
      res.status(201).json({ url: newUrl, story: serializeOwned(story) })
    } catch (err) {
      removeUploadedFile(newUrl)
      handleOwnedError(err, res, next)
    }
  },
)

export default router

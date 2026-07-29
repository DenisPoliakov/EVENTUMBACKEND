import express from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'

import prisma from '../prisma.js'
import {
  serializeWellnessStory,
  validateWellnessStoryPayload,
  wellnessStoryCountInclude,
} from '../lib/wellnessStories.js'

const router = express.Router()
const uploadDir = path.join(
  process.cwd(),
  'public',
  'uploads',
  'wellness-stories'
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

const serializeAdminStory = (story) =>
  serializeWellnessStory(story, { includeAdminFields: true })

const handleSlugConflict = (err, res, next) => {
  if (err.code === 'P2002' && err.meta?.target?.includes('slug')) {
    return res.status(409).json({ error: 'slug is already in use' })
  }
  return next(err)
}

router.get('/', async (req, res, next) => {
  try {
    const includeDeleted = String(req.query.includeDeleted || '') === 'true'
    const stories = await prisma.wellnessStory.findMany({
      where: {
        locale: 'ru',
        deletedAt: includeDeleted ? undefined : null,
      },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      include: wellnessStoryCountInclude,
    })
    res.json(stories.map(serializeAdminStory))
  } catch (err) {
    next(err)
  }
})

router.post('/import', async (req, res, next) => {
  try {
    const items = req.body?.stories
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'stories must be a non-empty JSON array',
      })
    }
    if (items.length > 500) {
      return res.status(400).json({
        error: 'stories must contain at most 500 items',
      })
    }

    const validated = []
    const slugs = new Set()
    for (const [index, item] of items.entries()) {
      const parsed = validateWellnessStoryPayload(item)
      if (parsed.error) {
        return res.status(400).json({
          error: `stories[${index}]: ${parsed.error}`,
        })
      }
      if (!parsed.data.slug) {
        return res.status(400).json({
          error: `stories[${index}]: slug is required for import`,
        })
      }
      if (slugs.has(parsed.data.slug)) {
        return res.status(400).json({
          error: `stories[${index}]: duplicate slug "${parsed.data.slug}"`,
        })
      }
      slugs.add(parsed.data.slug)
      validated.push(parsed.data)
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.wellnessStory.findMany({
        where: { slug: { in: [...slugs] } },
        select: { slug: true },
      })
      const existingSlugs = new Set(existing.map((story) => story.slug))
      const stories = []

      for (const data of validated) {
        stories.push(
          await tx.wellnessStory.upsert({
            where: { slug: data.slug },
            create: data,
            update: { ...data, deletedAt: null },
            include: wellnessStoryCountInclude,
          })
        )
      }

      return {
        created: validated.filter((story) => !existingSlugs.has(story.slug))
          .length,
        updated: validated.filter((story) => existingSlugs.has(story.slug))
          .length,
        stories: stories.map(serializeAdminStory),
      }
    })

    res.json(result)
  } catch (err) {
    handleSlugConflict(err, res, next)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const story = await prisma.wellnessStory.findFirst({
      where: {
        id: req.params.id,
        deletedAt: null,
      },
      include: wellnessStoryCountInclude,
    })
    if (!story) {
      return res.status(404).json({ error: 'Wellness story not found' })
    }
    res.json(serializeAdminStory(story))
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const parsed = validateWellnessStoryPayload(req.body)
    if (parsed.error) return res.status(400).json({ error: parsed.error })

    const story = await prisma.wellnessStory.create({
      data: parsed.data,
      include: wellnessStoryCountInclude,
    })
    res.status(201).json(serializeAdminStory(story))
  } catch (err) {
    handleSlugConflict(err, res, next)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const parsed = validateWellnessStoryPayload(req.body, { partial: true })
    if (parsed.error) return res.status(400).json({ error: parsed.error })

    const existing = await prisma.wellnessStory.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Wellness story not found' })
    }

    const story = await prisma.wellnessStory.update({
      where: { id: existing.id },
      data: parsed.data,
      include: wellnessStoryCountInclude,
    })
    res.json(serializeAdminStory(story))
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Wellness story not found' })
    }
    handleSlugConflict(err, res, next)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await prisma.wellnessStory.updateMany({
      where: {
        id: req.params.id,
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
    next(err)
  }
})

router.post('/:id/cover', uploadCover, async (req, res, next) => {
  const newUrl = req.file
    ? `/uploads/wellness-stories/${req.file.filename}`
    : null

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const existing = await prisma.wellnessStory.findFirst({
      where: {
        id: req.params.id,
        deletedAt: null,
      },
      select: {
        id: true,
        coverImageUrl: true,
      },
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

    res.status(201).json({
      url: newUrl,
      story: serializeAdminStory(story),
    })
  } catch (err) {
    removeUploadedFile(newUrl)
    next(err)
  }
})

export default router

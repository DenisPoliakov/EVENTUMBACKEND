import express from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import prisma from '../prisma.js'
import {
  createNews,
  newsIncludeShape,
  normalizeNewsTypeFilter,
  serializeNews,
  syncNewsNotifications,
  validateNewsPayload,
} from '../lib/news.js'

const router = express.Router()
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'news')
fs.mkdirSync(uploadDir, { recursive: true })

const imageExtensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
])

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      callback(null, `${unique}${imageExtensions.get(file.mimetype) || '.jpg'}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!imageExtensions.has(file.mimetype)) {
      return callback(
        new Error('Only JPEG, PNG, WebP, and GIF images are allowed')
      )
    }
    callback(null, true)
  },
})

const uploadImage = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must not exceed 5 MB'
        : err.message || 'Invalid image'
    return res.status(400).json({ error: message })
  })
}

const removeUploadedFile = (url) => {
  if (!url || !url.startsWith('/uploads/news/')) return
  fs.promises.unlink(path.join(uploadDir, path.basename(url))).catch(() => {})
}

router.get('/', async (req, res, next) => {
  try {
    const type = normalizeNewsTypeFilter(req.query.type)
    if (type === null) return res.status(400).json({ error: 'type is invalid' })
    const news = await prisma.news.findMany({
      where: {
        clubId: req.query.clubId || undefined,
        type,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: newsIncludeShape,
    })
    res.json(news.map(serializeNews))
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const validated = validateNewsPayload(req.body)
    if (validated.error) {
      return res.status(400).json({ error: validated.error })
    }
    if (validated.data.clubId) {
      const club = await prisma.sportClub.findUnique({
        where: { id: validated.data.clubId },
      })
      if (!club) return res.status(404).json({ error: 'Club not found' })
    }

    const news = await createNews(validated.data)
    res.status(201).json(serializeNews(news))
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const validated = validateNewsPayload(req.body, { partial: true })
    if (validated.error) {
      return res.status(400).json({ error: validated.error })
    }
    if (validated.data.clubId) {
      const club = await prisma.sportClub.findUnique({
        where: { id: validated.data.clubId },
      })
      if (!club) return res.status(404).json({ error: 'Club not found' })
    }
    const news = await prisma.news.update({
      where: { id: req.params.id },
      data: validated.data,
      include: newsIncludeShape,
    })
    await syncNewsNotifications(news)
    res.json(serializeNews(news))
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'News not found' })
    next(err)
  }
})

router.post('/:id/image', uploadImage, async (req, res, next) => {
  const newUrl = req.file ? `/uploads/news/${req.file.filename}` : null
  try {
    if (!newUrl) return res.status(400).json({ error: 'No file uploaded' })
    const existing = await prisma.news.findUnique({
      where: { id: req.params.id },
      select: { id: true, imageUrl: true },
    })
    if (!existing) {
      removeUploadedFile(newUrl)
      return res.status(404).json({ error: 'News not found' })
    }

    const news = await prisma.news.update({
      where: { id: existing.id },
      data: { imageUrl: newUrl },
      include: newsIncludeShape,
    })
    removeUploadedFile(existing.imageUrl)
    await syncNewsNotifications(news)
    res.status(201).json({ url: newUrl, news: serializeNews(news) })
  } catch (err) {
    removeUploadedFile(newUrl)
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const news = await prisma.news.delete({ where: { id: req.params.id } })
    removeUploadedFile(news.imageUrl)
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'News not found' })
    next(err)
  }
})

export default router

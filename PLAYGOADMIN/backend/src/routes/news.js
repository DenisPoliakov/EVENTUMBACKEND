import express from 'express'
import prisma from '../prisma.js'
import { createNews, newsIncludeShape, serializeNews, syncNewsNotifications } from '../lib/news.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const news = await prisma.news.findMany({
      where: {
        clubId: req.query.clubId || undefined,
        type: req.query.type || undefined,
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
    const { title, body, imageUrl, publishedAt, clubId } = req.body
    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' })
    }
    if (clubId) {
      const club = await prisma.sportClub.findUnique({ where: { id: String(clubId) } })
      if (!club) return res.status(404).json({ error: 'Club not found' })
    }

    const news = await createNews({
      title,
      body,
      imageUrl,
      publishedAt,
      clubId,
      type: 'MANUAL',
    })
    res.status(201).json(serializeNews(news))
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { title, body, imageUrl, publishedAt, clubId } = req.body
    if (clubId) {
      const club = await prisma.sportClub.findUnique({ where: { id: String(clubId) } })
      if (!club) return res.status(404).json({ error: 'Club not found' })
    }
    const news = await prisma.news.update({
      where: { id: req.params.id },
      data: {
        title,
        body,
        imageUrl: imageUrl || null,
        clubId: clubId || null,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
      },
      include: newsIncludeShape,
    })
    await syncNewsNotifications(news)
    res.json(serializeNews(news))
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'News not found' })
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'News not found' })
    next(err)
  }
})

export default router

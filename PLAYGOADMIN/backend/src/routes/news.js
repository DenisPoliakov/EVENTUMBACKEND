import express from 'express'
import prisma from '../prisma.js'
import { createNews, serializeNews } from '../lib/news.js'

const router = express.Router()

const includeShape = {
  stadium: { include: { city: true } },
  match: { include: { stadium: { include: { city: true } } } },
}

router.get('/', async (req, res, next) => {
  try {
    const news = await prisma.news.findMany({
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: includeShape,
    })
    res.json(news.map(serializeNews))
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { title, body, imageUrl, publishedAt } = req.body
    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' })
    }

    const news = await createNews({
      title,
      body,
      imageUrl,
      publishedAt,
      type: 'MANUAL',
    })
    res.status(201).json(serializeNews(news))
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { title, body, imageUrl, publishedAt } = req.body
    const news = await prisma.news.update({
      where: { id: req.params.id },
      data: {
        title,
        body,
        imageUrl: imageUrl || null,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
      },
      include: includeShape,
    })
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

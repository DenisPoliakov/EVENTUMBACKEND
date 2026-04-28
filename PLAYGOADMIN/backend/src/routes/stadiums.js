import express from 'express'
import prisma from '../prisma.js'
import { createNews } from '../lib/news.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const { cityId } = req.query
    const stadiums = await prisma.stadium.findMany({
      where: cityId ? { cityId } : undefined,
      orderBy: { name: 'asc' },
      include: { city: true },
    })
    res.json(stadiums)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { name, address, description, cityId, latitude, longitude, imageUrl } = req.body
    if (!name || !address || !cityId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'name, address, cityId, latitude and longitude are required' })
    }
    const stadium = await prisma.stadium.create({
      data: {
        name,
        address,
        description,
        cityId,
        latitude,
        longitude,
        imageUrl,
      },
      include: { city: true },
    })
    await createNews({
      title: 'Добавлен новый стадион',
      body: `На платформе появился новый стадион "${stadium.name}"${stadium.city?.name ? ' в городе ' + stadium.city.name : ''}.`,
      imageUrl: stadium.imageUrl || null,
      type: 'STADIUM_CREATED',
      stadiumId: stadium.id,
    })
    res.status(201).json(stadium)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const stadium = await prisma.stadium.findUnique({
      where: { id: req.params.id },
      include: { city: true },
    })
    if (!stadium) return res.status(404).json({ error: 'Stadium not found' })
    res.json(stadium)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { name, address, description, cityId, latitude, longitude, imageUrl } = req.body
    const stadium = await prisma.stadium.update({
      where: { id: req.params.id },
      data: { name, address, description, cityId, latitude, longitude, imageUrl },
    })
    res.json(stadium)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Stadium not found' })
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.stadium.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Stadium not found' })
    next(err)
  }
})

export default router

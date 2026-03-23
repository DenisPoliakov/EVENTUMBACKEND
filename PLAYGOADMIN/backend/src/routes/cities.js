import express from 'express'
import prisma from '../prisma.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const cities = await prisma.city.findMany({
      orderBy: { name: 'asc' },
    })
    res.json(cities)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required' })
    const city = await prisma.city.create({ data: { name } })
    res.status(201).json(city)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const city = await prisma.city.findUnique({ where: { id: req.params.id } })
    if (!city) return res.status(404).json({ error: 'City not found' })
    res.json(city)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { name } = req.body
    const city = await prisma.city.update({ where: { id: req.params.id }, data: { name } })
    res.json(city)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'City not found' })
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.city.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'City not found' })
    next(err)
  }
})

export default router

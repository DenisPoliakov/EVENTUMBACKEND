import express from 'express'
import prisma from '../prisma.js'
import { createNews } from '../lib/news.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const { cityId, stadiumId, status } = req.query
    const matches = await prisma.match.findMany({
      where: {
        stadiumId: stadiumId || undefined,
        status: status || undefined,
        stadium: cityId ? { cityId } : undefined,
      },
      orderBy: { startTime: 'asc' },
      include: {
        stadium: { include: { city: true } },
        registrations: true,
      },
    })
    res.json(matches)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { stadiumId, startTime, endTime, format, maxTeams, priceCents, currency, status, approvalMode, description } = req.body
    if (!stadiumId || !startTime || !endTime || !format || !maxTeams || !status) {
      return res.status(400).json({ error: 'stadiumId, startTime, endTime, format, maxTeams and status are required' })
    }
    const match = await prisma.match.create({
      data: {
        stadiumId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        format,
        maxTeams,
        priceCents,
        currency,
        status,
        approvalMode: approvalMode || 'MANUAL',
        description,
      },
      include: {
        stadium: { include: { city: true } },
      },
    })
    await createNews({
      title: `Доступен новый матч на стадионе "${match.stadium?.name || 'Стадион'}"`,
      body: match.stadium?.city?.name
        ? `Открыт новый матч на стадионе "${match.stadium.name}" в городе ${match.stadium.city.name}.`
        : `Открыт новый матч на стадионе "${match.stadium?.name || 'Стадион'}".`,
      imageUrl: match.stadium?.imageUrl || null,
      type: 'MATCH_CREATED',
      stadiumId: match.stadiumId,
      matchId: match.id,
    })
    res.status(201).json(match)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        stadium: { include: { city: true } },
        registrations: {
          include: {
            team: { include: { captain: true } },
          },
        },
      },
    })
    if (!match) return res.status(404).json({ error: 'Match not found' })
    res.json(match)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { stadiumId, startTime, endTime, format, maxTeams, priceCents, currency, status, approvalMode, description } = req.body
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        stadiumId,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        format,
        maxTeams,
        priceCents,
        currency,
        status,
        approvalMode,
        description,
      },
    })
    res.json(match)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Match not found' })
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.match.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Match not found' })
    next(err)
  }
})

export default router

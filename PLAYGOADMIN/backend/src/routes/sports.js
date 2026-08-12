import express from 'express'
import prisma from '../prisma.js'
import { normalizeSportCode, serializeSport } from '../lib/ecosystem.js'

const router = express.Router()
const ALLOWED_SPORT_CODES = new Set(['FOOTBALL', 'BOXING'])

router.get('/', async (_req, res, next) => {
  try {
    const sports = await prisma.sport.findMany({ orderBy: { name: 'asc' } })
    res.json(sports.map(serializeSport))
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const code = normalizeSportCode(req.body.code)
    const name = String(req.body.name || '').trim()
    if (!code || !name) {
      return res.status(400).json({ error: 'code and name are required' })
    }
    if (!ALLOWED_SPORT_CODES.has(code)) {
      return res.status(400).json({
        error: 'Only FOOTBALL and BOXING are supported ecosystem products',
      })
    }

    const sport = await prisma.sport.create({
      data: {
        code,
        name,
        description: String(req.body.description || '').trim() || null,
      },
    })
    res.status(201).json(serializeSport(sport))
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Sport code already exists' })
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const sport = await prisma.sport.findUnique({ where: { id: req.params.id } })
    if (!sport) return res.status(404).json({ error: 'Sport not found' })
    res.json(serializeSport(sport))
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const code =
      req.body.code === undefined ? undefined : normalizeSportCode(req.body.code)
    if (code && !ALLOWED_SPORT_CODES.has(code)) {
      return res.status(400).json({
        error: 'Only FOOTBALL and BOXING are supported ecosystem products',
      })
    }
    const sport = await prisma.sport.update({
      where: { id: req.params.id },
      data: {
        code,
        name: req.body.name === undefined ? undefined : String(req.body.name || '').trim(),
        description:
          req.body.description === undefined
            ? undefined
            : String(req.body.description || '').trim() || null,
      },
    })
    res.json(serializeSport(sport))
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Sport not found' })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Sport code already exists' })
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const sport = await prisma.sport.findUnique({
      where: { id: req.params.id },
      select: { code: true },
    })
    if (!sport) return res.status(404).json({ error: 'Sport not found' })
    if (ALLOWED_SPORT_CODES.has(sport.code)) {
      return res.status(409).json({
        error: 'Core EVENTUM products cannot be deleted',
      })
    }
    await prisma.sport.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Sport not found' })
    next(err)
  }
})

export default router

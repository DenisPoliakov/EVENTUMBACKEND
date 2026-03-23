import express from 'express'
import prisma from '../prisma.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const { cityId } = req.query
  const teams = await prisma.team.findMany({
    where: cityId ? { cityId } : undefined,
    orderBy: { name: 'asc' },
    include: {
      city: true,
      captain: true,
      members: { include: { user: true } },
    },
  })
    res.json(teams)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { name, cityId, captainUserId } = req.body
    if (!name || !cityId || !captainUserId) {
      return res.status(400).json({ error: 'name, cityId and captainUserId are required' })
    }
    const team = await prisma.team.create({
      data: {
        name,
        cityId,
        captainUserId,
        members: {
          create: { userId: captainUserId, role: 'CAPTAIN' },
        },
      },
      include: { captain: true },
    })
    res.status(201).json(team)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        captain: true,
        members: { include: { user: true } },
      },
    })
    if (!team) return res.status(404).json({ error: 'Team not found' })
    res.json(team)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { name, cityId, captainUserId } = req.body
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: { name, cityId, captainUserId },
    })
    res.json(team)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Team not found' })
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const teamId = req.params.id
    // убрать зависимости, чтобы не ловить FK
    await prisma.teamMember.deleteMany({ where: { teamId } })
    await prisma.matchRegistration.updateMany({
      where: { teamId },
      data: { teamId: null },
    })
    await prisma.team.delete({ where: { id: teamId } })
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Team not found' })
    next(err)
  }
})

export default router

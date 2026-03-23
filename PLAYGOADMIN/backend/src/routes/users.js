import express from 'express'
import prisma from '../prisma.js'
import { generateUsername } from '../lib/auth.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined
    const cityId = typeof req.query.cityId === 'string' ? req.query.cityId : undefined
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined
    const blocked = typeof req.query.blocked === 'string' ? req.query.blocked : undefined
    const users = await prisma.user.findMany({
      where: {
        role: role || undefined,
        cityId: cityId || undefined,
        ...(blocked === 'active'
          ? {
              OR: [
                { isBlocked: true, blockedUntil: null },
                { isBlocked: true, blockedUntil: { gt: new Date() } },
              ],
            }
          : blocked === 'registration_ban'
            ? { matchBanUntil: { gt: new Date() } }
            : blocked === 'inactive'
              ? {
                  AND: [
                    {
                      OR: [
                        { isBlocked: false },
                        { blockedUntil: { lte: new Date() } },
                      ],
                    },
                    {
                      OR: [
                        { matchBanUntil: null },
                        { matchBanUntil: { lte: new Date() } },
                      ],
                    },
                  ],
                }
              : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { username: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        city: true,
        memberships: true,
        captainedTeams: true,
      },
    })
    res.json(users)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { email, name, username, firstName, lastName, passwordHash, role = 'USER', cityId } = req.body
    if (!email || !name || !passwordHash) {
      return res.status(400).json({ error: 'email, name and passwordHash are required' })
    }
    const user = await prisma.user.create({
      data: {
        email,
        name,
        username: username || generateUsername(email),
        firstName: firstName || null,
        lastName: lastName || null,
        passwordHash,
        role,
        cityId,
      },
    })
    res.status(201).json(user)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { email, name, username, firstName, lastName, passwordHash, role, cityId } = req.body
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { email, name, username, firstName, lastName, passwordHash, role, cityId },
    })
    res.json(user)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found' })
    next(err)
  }
})

router.patch('/:id/moderation', async (req, res, next) => {
  try {
    const {
      username,
      isBlocked,
      blockReason,
      blockedUntil,
      matchBanUntil,
      role,
    } = req.body

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        username: username === undefined ? undefined : username || null,
        role: role || undefined,
        isBlocked: isBlocked === undefined ? undefined : Boolean(isBlocked),
        blockReason: blockReason === undefined ? undefined : blockReason || null,
        blockedUntil:
          blockedUntil === undefined
            ? undefined
            : blockedUntil
              ? new Date(blockedUntil)
              : null,
        matchBanUntil:
          matchBanUntil === undefined
            ? undefined
            : matchBanUntil
              ? new Date(matchBanUntil)
              : null,
      },
      include: {
        city: true,
        memberships: true,
        captainedTeams: true,
      },
    })
    res.json(user)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found' })
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found' })
    next(err)
  }
})

export default router

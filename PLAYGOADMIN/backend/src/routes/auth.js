import express from 'express'
import prisma from '../prisma.js'
import {
  authResponse,
  generateUsername,
  hashPassword,
  normalizeIdentifier,
  splitName,
  verifyPassword,
} from '../lib/auth.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

const hasActiveBlock = (user) => {
  if (!user?.isBlocked) return false
  if (!user.blockedUntil) return true
  return new Date(user.blockedUntil) > new Date()
}

const buildBlockDetails = (user) => ({
  error: 'User is blocked',
  message: user.blockedUntil
    ? `Аккаунт заблокирован до ${new Date(user.blockedUntil).toISOString()}`
    : 'Аккаунт заблокирован бессрочно',
  blockReason: user.blockReason || '',
  blockedUntil: user.blockedUntil || null,
})

const ensureCity = async (rawCity) => {
  const cityName = (rawCity || '').trim()
  if (!cityName) return null

  let city = await prisma.city.findFirst({
    where: { name: { equals: cityName, mode: 'insensitive' } },
  })
  if (!city) {
    city = await prisma.city.create({ data: { name: cityName } })
  }
  return city
}

const uniqueUsername = async (seed) => {
  const base = generateUsername(seed)
  let candidate = base
  let index = 1
  while (true) {
    const exists = await prisma.user.findUnique({ where: { username: candidate } })
    if (!exists) return candidate
    candidate = `${base}${index}`
    index += 1
  }
}

router.post('/auth/register', async (req, res, next) => {
  try {
    const email = normalizeIdentifier(req.body.email)
    const usernameInput = normalizeIdentifier(req.body.username)
    const password = req.body.password || ''
    const firstName = (req.body.firstName || '').trim()
    const lastName = (req.body.lastName || '').trim()
    const cityName = (req.body.city || '').trim()

    if (!email || !usernameInput || !password || !cityName) {
      return res.status(400).json({ error: 'email, username, password and city are required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' })
    }

    const city = await ensureCity(cityName)
    const username = await uniqueUsername(usernameInput)
    const user = await prisma.user.create({
      data: {
        email,
        username,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim() || username,
        passwordHash: hashPassword(password),
        role: 'USER',
        cityId: city?.id,
      },
      include: { city: true, playerCard: true },
    })

    return res.status(201).json(authResponse(user, city?.name || cityName))
  } catch (err) {
    next(err)
  }
})

router.post('/auth/login', async (req, res, next) => {
  try {
    const identifier = normalizeIdentifier(req.body.identifier)
    const password = req.body.password || ''
    if (!identifier || !password) {
      return res.status(400).json({ error: 'identifier and password are required' })
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: { city: true, playerCard: true },
    })

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (hasActiveBlock(user)) {
      return res.status(403).json(buildBlockDetails(user))
    }

    return res.json(authResponse(user, user.city?.name || ''))
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      include: { city: true, playerCard: true },
    })
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (hasActiveBlock(user)) return res.status(403).json(buildBlockDetails(user))
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        city: user.city?.name || '',
        isBlocked: Boolean(user.isBlocked),
        blockReason: user.blockReason || '',
        blockedUntil: user.blockedUntil || null,
        matchBanUntil: user.matchBanUntil || null,
        hasPlayerCard: Boolean(user.playerCard),
      },
    })
  } catch (err) {
    next(err)
  }
})

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const email = normalizeIdentifier(req.body.email)
    const firstName = (req.body.firstName || '').trim()
    const lastName = (req.body.lastName || '').trim()
    const cityName = (req.body.city || '').trim()
    if (!email || !cityName) {
      return res.status(400).json({ error: 'email and city are required' })
    }

    const city = await ensureCity(cityName)
    const user = await prisma.user.update({
      where: { id: req.auth.sub },
      data: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim() || email,
        cityId: city?.id,
      },
      include: { city: true, playerCard: true },
    })
    if (hasActiveBlock(user)) return res.status(403).json(buildBlockDetails(user))

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        city: user.city?.name || cityName,
        isBlocked: Boolean(user.isBlocked),
        blockReason: user.blockReason || '',
        blockedUntil: user.blockedUntil || null,
        matchBanUntil: user.matchBanUntil || null,
        hasPlayerCard: Boolean(user.playerCard),
      },
    })
  } catch (err) {
    next(err)
  }
})

router.post('/me/password/check', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } })
    if (!user || hasActiveBlock(user) || !verifyPassword(req.body.password || '', user.passwordHash)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.post('/me/password', requireAuth, async (req, res, next) => {
  try {
    const oldPassword = req.body.oldPassword || ''
    const newPassword = req.body.newPassword || ''
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'new password must be at least 6 characters' })
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } })
    if (!user || hasActiveBlock(user) || !verifyPassword(oldPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword) },
    })
    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router

import express from 'express'
import prisma from '../prisma.js'
import {
  authResponse,
  generateUsername,
  hashPassword,
  normalizeIdentifier,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyPassword,
} from '../lib/auth.js'
import { parseBirthDate } from '../lib/dates.js'
import {
  avatarUpload,
  removeAvatarFile,
  toPublicAvatarUrl,
} from '../lib/avatars.js'
import {
  parseHideFlag,
  parseProfileVisibility,
  privacySettingsFromUser,
} from '../lib/privacy.js'
import { applyReferralCode, ensureReferralCode } from '../lib/referrals.js'
import { deleteUserAccount } from '../lib/userDeletion.js'
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

const serializeSelfUser = (user, cityName = '') => ({
  id: user.id,
  email: user.email,
  username: user.username || '',
  phone: user.phone || '',
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  birthDate: user.birthDate
    ? new Date(user.birthDate).toISOString().slice(0, 10)
    : null,
  city: cityName || user.city?.name || '',
  avatarUrl: user.avatarUrl || user.playerCard?.avatarUrl || '',
  isBlocked: Boolean(user.isBlocked),
  blockReason: user.blockReason || '',
  blockedUntil: user.blockedUntil || null,
  matchBanUntil: user.matchBanUntil || null,
  hasPlayerCard: Boolean(user.playerCard),
  privacy: {
    profileVisibility: user.profileVisibility || 'PUBLIC',
    hideEmail: Boolean(user.hideEmail),
    hidePhone: Boolean(user.hidePhone),
    hideBirthDate: Boolean(user.hideBirthDate),
    hideCity: Boolean(user.hideCity),
    hideCoachContacts: Boolean(user.hideCoachContacts),
  },
})


router.post('/auth/register', async (req, res, next) => {
  try {
    const email = normalizeIdentifier(req.body.email)
    const usernameInput = normalizeIdentifier(req.body.username)
    const phone = String(req.body.phone || '').trim()
    const password = req.body.password || ''
    const firstName = (req.body.firstName || '').trim()
    const lastName = (req.body.lastName || '').trim()
    const cityName = (req.body.city || '').trim()
    const referralCode = String(
      req.body.referralCode ?? req.body.inviteCode ?? '',
    ).trim()
    const birthDateParsed = parseBirthDate(
      req.body.birthDate ?? req.body.dateOfBirth,
    )

    if (!email || !usernameInput || !password || !cityName) {
      return res.status(400).json({ error: 'email, username, password and city are required' })
    }
    if (birthDateParsed.skipped || birthDateParsed.value == null) {
      return res.status(400).json({ error: 'birthDate is required (YYYY-MM-DD)' })
    }
    if (birthDateParsed.error) {
      return res.status(400).json({ error: birthDateParsed.error })
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
        phone: phone || null,
        firstName,
        lastName,
        birthDate: birthDateParsed.value,
        name: `${firstName} ${lastName}`.trim() || username,
        passwordHash: hashPassword(password),
        role: 'USER',
        cityId: city?.id,
      },
      include: { city: true, playerCard: true },
    })

    await ensureReferralCode(user.id)
    let referral = null
    if (referralCode) {
      referral = await applyReferralCode(user.id, referralCode)
      if (referral.error) {
        await prisma.user.delete({ where: { id: user.id } })
        return res.status(referral.status).json({ error: referral.error })
      }
    }

    const response = await authResponse(user, city?.name || cityName)
    return res.status(201).json({
      ...response,
      referralBonus: referral
        ? {
            applied: true,
            premiumDays: referral.redemption.referredBonusDays,
            expiresAt: referral.bonusSubscription?.expiresAt || null,
          }
        : null,
    })
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

    await ensureReferralCode(user.id)
    return res.json(await authResponse(user, user.city?.name || ''))
  } catch (err) {
    next(err)
  }
})

router.post('/auth/refresh', async (req, res, next) => {
  try {
    const response = await rotateRefreshToken(String(req.body.refreshToken || ''))
    if (!response) return res.status(401).json({ error: 'Invalid refresh token' })
    return res.json(response)
  } catch (err) {
    next(err)
  }
})

router.post('/auth/logout', async (req, res, next) => {
  try {
    await revokeRefreshToken(String(req.body.refreshToken || ''))
    return res.status(204).send()
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
    return res.json({ user: serializeSelfUser(user) })
  } catch (err) {
    next(err)
  }
})

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const email = normalizeIdentifier(req.body.email)
    const username =
      req.body.username === undefined ? undefined : normalizeIdentifier(req.body.username)
    const phone =
      req.body.phone === undefined ? undefined : String(req.body.phone || '').trim() || null
    const firstName = (req.body.firstName || '').trim()
    const lastName = (req.body.lastName || '').trim()
    const cityName = (req.body.city || '').trim()
    const birthDateParsed = parseBirthDate(
      req.body.birthDate ?? req.body.dateOfBirth,
    )
    if (!email || !cityName) {
      return res.status(400).json({ error: 'email and city are required' })
    }
    if (req.body.username !== undefined && !username) {
      return res.status(400).json({ error: 'username is required' })
    }
    if (birthDateParsed.error) {
      return res.status(400).json({ error: birthDateParsed.error })
    }

    if (username) {
      const existing = await prisma.user.findUnique({ where: { username } })
      if (existing && existing.id !== req.auth.sub) {
        return res.status(409).json({ error: 'username is already taken' })
      }
    }

    const city = await ensureCity(cityName)
    const user = await prisma.user.update({
      where: { id: req.auth.sub },
      data: {
        email,
        username,
        phone,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim() || username || email,
        cityId: city?.id,
        ...(birthDateParsed.skipped ? {} : { birthDate: birthDateParsed.value }),
      },
      include: { city: true, playerCard: true },
    })
    if (hasActiveBlock(user)) return res.status(403).json(buildBlockDetails(user))

    return res.json({ user: serializeSelfUser(user, cityName) })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'email or username is already taken' })
    next(err)
  }
})

router.get('/me/privacy', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } })
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    return res.json({ privacy: privacySettingsFromUser(user) })
  } catch (err) {
    next(err)
  }
})

const handleAvatarUpload = (req, res, next) => {
  avatarUpload.single('file')(req, res, (err) => {
    if (!err) return next()
    return res.status(400).json({
      error: err.message || 'Invalid image',
    })
  })
}

router.post('/me/avatar', requireAuth, handleAvatarUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const url = toPublicAvatarUrl(req.file.filename)

    const existing = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      include: { city: true, playerCard: true },
    })
    if (!existing) {
      removeAvatarFile(url)
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: req.auth.sub },
        data: { avatarUrl: url },
        include: { city: true, playerCard: true },
      })

      if (updated.playerCard) {
        await tx.playerCard.update({
          where: { userId: updated.id },
          data: { avatarUrl: url },
        })
      }

      return tx.user.findUnique({
        where: { id: updated.id },
        include: { city: true, playerCard: true },
      })
    })

    if (existing.avatarUrl && existing.avatarUrl !== url) {
      removeAvatarFile(existing.avatarUrl)
    }
    if (
      existing.playerCard?.avatarUrl &&
      existing.playerCard.avatarUrl !== url &&
      existing.playerCard.avatarUrl !== existing.avatarUrl
    ) {
      removeAvatarFile(existing.playerCard.avatarUrl)
    }

    return res.status(201).json({
      url,
      avatarUrl: url,
      user: serializeSelfUser(user),
      savedToDatabase: true,
    })
  } catch (err) {
    if (req.file) removeAvatarFile(toPublicAvatarUrl(req.file.filename))
    next(err)
  }
})

router.delete('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      include: { city: true, playerCard: true },
    })
    if (!existing) return res.status(401).json({ error: 'Unauthorized' })

    const user = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.auth.sub },
        data: { avatarUrl: null },
      })
      if (existing.playerCard) {
        await tx.playerCard.update({
          where: { userId: req.auth.sub },
          data: { avatarUrl: null },
        })
      }
      return tx.user.findUnique({
        where: { id: req.auth.sub },
        include: { city: true, playerCard: true },
      })
    })

    removeAvatarFile(existing.avatarUrl)
    if (existing.playerCard?.avatarUrl) {
      removeAvatarFile(existing.playerCard.avatarUrl)
    }

    return res.json({
      avatarUrl: '',
      user: serializeSelfUser(user),
    })
  } catch (err) {
    next(err)
  }
})

router.patch('/me/privacy', requireAuth, async (req, res, next) => {
  try {
    const current = await prisma.user.findUnique({ where: { id: req.auth.sub } })
    if (!current) return res.status(401).json({ error: 'Unauthorized' })

    const profileVisibility = parseProfileVisibility(
      req.body.profileVisibility,
      current.profileVisibility || 'PUBLIC',
    )
    const hideEmail = parseHideFlag(req.body.hideEmail, current.hideEmail)
    const hidePhone = parseHideFlag(req.body.hidePhone, current.hidePhone)
    const hideBirthDate = parseHideFlag(req.body.hideBirthDate, current.hideBirthDate)
    const hideCity = parseHideFlag(req.body.hideCity, current.hideCity)
    const hideCoachContacts = parseHideFlag(
      req.body.hideCoachContacts,
      current.hideCoachContacts,
    )

    const user = await prisma.user.update({
      where: { id: req.auth.sub },
      data: {
        profileVisibility,
        hideEmail,
        hidePhone,
        hideBirthDate,
        hideCity,
        hideCoachContacts,
      },
      include: { city: true, playerCard: true },
    })

    return res.json({
      privacy: privacySettingsFromUser(user),
      user: serializeSelfUser(user),
    })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
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

router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const deleted = await deleteUserAccount(req.auth.sub)
    if (!deleted) return res.status(404).json({ error: 'User not found' })
    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router

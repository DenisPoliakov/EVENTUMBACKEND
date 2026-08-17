import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

import prisma from '../prisma.js'
import { requireAuth, optionalAuth } from '../middleware/requireAuth.js'
import { removeAvatarFile } from '../lib/avatars.js'
import { redactUserForViewer, resolveFriendshipFlag } from '../lib/privacy.js'

const router = express.Router()

const PLAYER_POSITIONS = ['GK', 'DF', 'MF', 'FW']
const PREFERRED_FEET = ['LEFT', 'RIGHT', 'BOTH']
const MATCH_FORMATS = ['FIVE_X_FIVE', 'SEVEN_X_SEVEN', 'ELEVEN_X_ELEVEN']
const SKILL_TAGS = ['PACE', 'SHOOTING', 'PASSING', 'DRIBBLING', 'STAMINA', 'DEFENDING']
const PLAYER_STATUSES = ['LOOKING_FOR_TEAM', 'READY_TO_PLAY', 'CAPTAIN', 'WITHOUT_TEAM']

const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'players')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `${unique}${ext}`)
  },
})

const upload = multer({ storage })

const removeUploadedFile = (url) => {
  if (!url || !url.startsWith('/uploads/players/')) return
  const filename = path.basename(url)
  const filePath = path.join(uploadDir, filename)
  fs.promises.unlink(filePath).catch(() => {})
}

const normalizeList = (values, allowed, maxCount = 3) => {
  const raw = Array.isArray(values) ? values : []
  const unique = [...new Set(raw.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean))]
  const normalized = unique.filter((item) => allowed.includes(item))
  return normalized.slice(0, maxCount)
}

const toNullableInt = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

const clampRating = (value) => {
  const parsed = toNullableInt(value)
  if (parsed == null) return 70
  return Math.max(40, Math.min(99, parsed))
}

const validatePayload = (body) => {
  const position = String(body.position || '').trim().toUpperCase()
  const preferredFoot = String(body.preferredFoot || '').trim().toUpperCase()
  const favoriteFormat = String(body.favoriteFormat || '').trim().toUpperCase()
  const skillTags = normalizeList(body.skillTags, SKILL_TAGS, 3)
  const statuses = normalizeList(body.statuses, PLAYER_STATUSES, 3)

  if (!PLAYER_POSITIONS.includes(position)) {
    return { error: 'position is invalid' }
  }
  if (!PREFERRED_FEET.includes(preferredFoot)) {
    return { error: 'preferredFoot is invalid' }
  }
  if (!MATCH_FORMATS.includes(favoriteFormat)) {
    return { error: 'favoriteFormat is invalid' }
  }
  if (skillTags.length == 0) {
    return { error: 'Choose at least one strong side' }
  }
  if (statuses.length == 0) {
    return { error: 'Choose at least one player status' }
  }

  return {
    data: {
      position,
      preferredFoot,
      favoriteFormat,
      heightCm: toNullableInt(body.heightCm),
      weightKg: toNullableInt(body.weightKg),
      age: toNullableInt(body.age),
      bio: String(body.bio || '').trim() || null,
      avatarUrl: String(body.avatarUrl || '').trim() || null,
      skillTags,
      statuses,
      rating: clampRating(body.rating),
    },
  }
}

const serializeCard = (card, viewerContext = { isSelf: true, isFriend: true }) => {
  const redactedUser = card.user
    ? redactUserForViewer(card.user, viewerContext)
    : null
  const cityHidden = Boolean(card.user?.hideCity) && !viewerContext.isSelf
  const detailsHidden =
    redactedUser?.privacy?.limited === true && !viewerContext.isSelf

  return {
    id: card.id,
    userId: card.userId,
    position: card.position,
    preferredFoot: card.preferredFoot,
    heightCm: detailsHidden ? null : card.heightCm,
    weightKg: detailsHidden ? null : card.weightKg,
    age: detailsHidden ? null : card.age,
    favoriteFormat: card.favoriteFormat,
    bio: detailsHidden ? '' : card.bio || '',
    avatarUrl: card.avatarUrl || card.user?.avatarUrl || '',
    skillTags: card.skillTags || [],
    statuses: card.statuses || [],
    rating: card.rating,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    city: cityHidden ? '' : card.city?.name || card.user?.city?.name || '',
    user: redactedUser
      ? {
          id: redactedUser.id,
          email: redactedUser.email,
          username: redactedUser.username,
          firstName: redactedUser.firstName,
          lastName: redactedUser.lastName,
          phone: redactedUser.phone,
          birthDate: redactedUser.birthDate,
          city: redactedUser.city,
          avatarUrl: redactedUser.avatarUrl || card.avatarUrl || '',
          profileVisibility: redactedUser.profileVisibility,
          privacy: redactedUser.privacy,
        }
      : null,
    currentTeam: detailsHidden
      ? null
      : card.user.memberships?.[0]?.team
        ? {
            id: card.user.memberships[0].team.id,
            name: card.user.memberships[0].team.name,
            city: card.user.memberships[0].team.city?.name || '',
            captain: {
              id: card.user.memberships[0].team.captain?.id || '',
              username: card.user.memberships[0].team.captain?.username || '',
              firstName: card.user.memberships[0].team.captain?.firstName || '',
              lastName: card.user.memberships[0].team.captain?.lastName || '',
            },
            memberCount: card.user.memberships[0].team.members?.length || 0,
          }
        : null,
  }
}

const serializeCardForViewer = async (card, viewerId = null) => {
  if (!card?.user) return serializeCard(card)
  const flags = viewerId
    ? await resolveFriendshipFlag(viewerId, card.user.id)
    : { isSelf: false, isFriend: false }
  return serializeCard(card, flags)
}
const includeShape = {
  city: true,
  user: {
    include: {
      city: true,
      memberships: {
        include: {
          team: {
            include: {
              city: true,
              captain: true,
              members: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  },
}

const ensureCity = async (rawCity) => {
  const cityName = String(rawCity || '').trim()
  if (!cityName) return null

  let city = await prisma.city.findFirst({
    where: { name: { equals: cityName, mode: 'insensitive' } },
  })
  if (!city) {
    city = await prisma.city.create({ data: { name: cityName } })
  }
  return city
}

router.get('/player-card-options', (_req, res) => {
  res.json({
    positions: PLAYER_POSITIONS,
    preferredFeet: PREFERRED_FEET,
    formats: MATCH_FORMATS,
    skillTags: SKILL_TAGS,
    statuses: PLAYER_STATUSES,
  })
})

router.get('/players', optionalAuth, async (req, res, next) => {
  try {
    const cityId = String(req.query.cityId || '').trim()
    const city = String(req.query.city || '').trim()
    const position = String(req.query.position || '').trim().toUpperCase()
    const skill = String(req.query.skill || '').trim().toUpperCase()
    const minRating = toNullableInt(req.query.minRating)
    const maxRating = toNullableInt(req.query.maxRating)
    const lookingForTeam = String(req.query.lookingForTeam || '').trim() === 'true'
    const q = String(req.query.q || '').trim()

    const cards = await prisma.playerCard.findMany({
      where: {
        cityId: cityId || undefined,
        position: position || undefined,
        skillTags: skill ? { has: skill } : undefined,
        statuses: lookingForTeam ? { has: 'LOOKING_FOR_TEAM' } : undefined,
        rating: minRating != null || maxRating != null ? {
          gte: minRating ?? undefined,
          lte: maxRating ?? undefined,
        } : undefined,
        OR: q ? [
          { user: { username: { contains: q, mode: 'insensitive' } } },
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
          { bio: { contains: q, mode: 'insensitive' } },
        ] : undefined,
        city: city ? { name: { equals: city, mode: 'insensitive' } } : undefined,
      },
      include: includeShape,
      orderBy: [{ rating: 'desc' }, { updatedAt: 'desc' }],
    })

    const viewerId = req.auth?.sub || null
    res.json(await Promise.all(cards.map((card) => serializeCardForViewer(card, viewerId))))
  } catch (err) {
    next(err)
  }
})

router.get('/players/:userId', optionalAuth, async (req, res, next) => {
  try {
    const card = await prisma.playerCard.findFirst({
      where: { userId: req.params.userId },
      include: includeShape,
    })
    if (!card) return res.status(404).json({ error: 'Player card not found' })
    res.json(await serializeCardForViewer(card, req.auth?.sub || null))
  } catch (err) {
    next(err)
  }
})

router.get('/me/player-card', requireAuth, async (req, res, next) => {
  try {
    const card = await prisma.playerCard.findUnique({
      where: { userId: req.auth.sub },
      include: includeShape,
    })
    res.json({
      playerCard: card
        ? serializeCard(card, { isSelf: true, isFriend: true })
        : null,
    })
  } catch (err) {
    next(err)
  }
})

router.put('/me/player-card', requireAuth, async (req, res, next) => {
  try {
    const parsed = validatePayload(req.body)
    if (parsed.error) return res.status(400).json({ error: parsed.error })

    const user = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      include: { city: true, playerCard: true },
    })
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const city = req.body.city
      ? await ensureCity(req.body.city)
      : user.cityId
          ? await prisma.city.findUnique({ where: { id: user.cityId } })
          : null

    const card = await prisma.playerCard.upsert({
      where: { userId: user.id },
      update: {
        ...parsed.data,
        cityId: city?.id || user.cityId || null,
      },
      create: {
        userId: user.id,
        cityId: city?.id || user.cityId || null,
        ...parsed.data,
      },
      include: includeShape,
    })

    if (parsed.data.avatarUrl) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: parsed.data.avatarUrl },
      })
    } else if (!user.avatarUrl && card.avatarUrl) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: card.avatarUrl },
      })
    } else if (user.avatarUrl && !card.avatarUrl) {
      await prisma.playerCard.update({
        where: { userId: user.id },
        data: { avatarUrl: user.avatarUrl },
      })
    }

    const fresh = await prisma.playerCard.findUnique({
      where: { userId: user.id },
      include: includeShape,
    })

    res.json({ playerCard: serializeCard(fresh) })
  } catch (err) {
    next(err)
  }
})

router.post('/me/player-card/avatar', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const url = `/uploads/players/${req.file.filename}`

    const existing = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      include: { playerCard: { include: includeShape } },
    })
    if (!existing) {
      removeUploadedFile(url)
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const previousUrls = [existing.avatarUrl, existing.playerCard?.avatarUrl].filter(Boolean)

    const result = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.auth.sub },
        data: { avatarUrl: url },
      })

      let playerCard = null
      if (existing.playerCard) {
        playerCard = await tx.playerCard.update({
          where: { userId: req.auth.sub },
          data: { avatarUrl: url },
          include: includeShape,
        })
      }

      const user = await tx.user.findUnique({
        where: { id: req.auth.sub },
        include: { city: true, playerCard: true },
      })

      return { user, playerCard }
    })

    for (const oldUrl of previousUrls) {
      if (oldUrl && oldUrl !== url) {
        removeUploadedFile(oldUrl)
        removeAvatarFile(oldUrl)
      }
    }

    res.status(201).json({
      url,
      avatarUrl: url,
      playerCard: result.playerCard ? serializeCard(result.playerCard) : null,
      savedToDatabase: true,
      userAvatarUpdated: true,
    })
  } catch (err) {
    if (req.file) removeUploadedFile(`/uploads/players/${req.file.filename}`)
    next(err)
  }
})

export default router

import express from 'express'
import prisma from '../prisma.js'
import playerCardRouter from './playerCards.js'
import {
  ensureTeamForRegistration,
  getAutoApprovalStatus,
  hasActiveRegistrationForCaptain,
  hasActiveRegistrationForTeam,
  syncMatchStatusByCapacity,
} from '../lib/registrations.js'
import { serializeNews } from '../lib/news.js'
const router = express.Router()

const hasActiveMatchBan = (user) =>
  Boolean(user?.matchBanUntil) && new Date(user.matchBanUntil) > new Date()

const hasActiveBlock = (user) => {
  if (!user?.isBlocked) return false
  if (!user.blockedUntil) return true
  return new Date(user.blockedUntil) > new Date()
}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

router.get('/news', async (_req, res, next) => {
  try {
    const news = await prisma.news.findMany({
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        stadium: { include: { city: true } },
        match: { include: { stadium: { include: { city: true } } } },
      },
    })
    res.json(news.map(serializeNews))
  } catch (err) {
    next(err)
  }
})

router.get('/stadiums', async (req, res, next) => {
  try {
    const { cityId, city } = req.query
    const where = cityId
      ? { cityId }
      : city
          ? { city: { name: { equals: String(city), mode: 'insensitive' } } }
          : undefined

    const stadiums = await prisma.stadium.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { city: true },
    })
    res.json(stadiums)
  } catch (err) {
    next(err)
  }
})

router.get('/matches', async (req, res, next) => {
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

router.get('/matches/:id', async (req, res, next) => {
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

router.get('/registrations', async (req, res, next) => {
  try {
    const { matchId, status, captainLogin, teamId } = req.query
    const registrations = await prisma.matchRegistration.findMany({
      where: {
        matchId: matchId || undefined,
        status: status || undefined,
        captainLogin: captainLogin || undefined,
        teamId: teamId || undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        team: { include: { captain: true } },
        match: { include: { stadium: { include: { city: true } } } },
      },
    })
    res.json(registrations)
  } catch (err) {
    next(err)
  }
})

router.post('/registrations', async (req, res, next) => {
  try {
    const { matchId, teamName, captainName, captainLogin, note, playersCount } = req.body
    if (!matchId || !teamName || !captainName || !captainLogin) {
      return res.status(400).json({ error: 'matchId, teamName, captainName, captainLogin are required' })
    }
    const autoApproval = await getAutoApprovalStatus(matchId)
    const match = autoApproval?.match
    if (!match) return res.status(404).json({ error: 'Match not found' })
    if (!['OPEN', 'FULL'].includes(match.status)) {
      return res.status(400).json({ error: 'Match is not open for registrations' })
    }

    const linkedUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: captainLogin }, { username: captainLogin }],
      },
      include: {
        playerCard: true,
        captainedTeams: {
          include: {
            captain: true,
            members: { include: { user: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        memberships: {
          include: {
            team: {
              include: {
                captain: true,
                members: { include: { user: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (linkedUser && hasActiveBlock(linkedUser)) {
      return res.status(403).json({
        error: 'User is blocked on the platform',
        message: linkedUser.blockedUntil
          ? `Аккаунт заблокирован до ${linkedUser.blockedUntil.toISOString()}${linkedUser.blockReason ? `. Причина: ${linkedUser.blockReason}` : ''}`
          : `Аккаунт заблокирован бессрочно${linkedUser.blockReason ? `. Причина: ${linkedUser.blockReason}` : ''}`,
      })
    }
    if (linkedUser && hasActiveMatchBan(linkedUser)) {
      return res.status(403).json({
        error: 'User is temporarily banned from match registrations',
        message: `Подача заявок недоступна до ${linkedUser.matchBanUntil.toISOString()}${linkedUser.blockReason ? `. Причина: ${linkedUser.blockReason}` : ''}`,
        matchBanUntil: linkedUser.matchBanUntil,
        reason: linkedUser.blockReason || '',
      })
    }
    if (!linkedUser?.playerCard) {
      return res.status(403).json({
        error: 'Player card required',
        message: 'Сначала создай карточку футболиста в профиле, потом можно подавать заявку на матч.',
      })
    }

    const ownedTeam =
      linkedUser?.captainedTeams?.[0] ?? linkedUser?.memberships?.[0]?.team ?? null
    if (!ownedTeam) {
      return res.status(403).json({
        error: 'Team required',
        message: 'Сначала создай команду или вступи в существующую, потом можно подавать заявку на матч.',
      })
    }

    const effectiveTeamId = ownedTeam.id
    const effectiveTeamName = ownedTeam.name || teamName
    const effectiveCaptainName =
      ownedTeam.captain?.name?.trim() ||
      [ownedTeam.captain?.firstName, ownedTeam.captain?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
      captainName
    const effectiveCaptainLogin =
      ownedTeam.captain?.email || ownedTeam.captain?.username || captainLogin

    if (
      await hasActiveRegistrationForTeam({
        matchId,
        teamId: effectiveTeamId,
      })
    ) {
      return res.status(409).json({
        error: 'Duplicate active registration',
        message: 'У команды уже есть активная заявка на этот матч.',
      })
    }

    const captainAliases = [captainLogin, linkedUser.email, linkedUser.username || '']
    if (
      await hasActiveRegistrationForCaptain({
        matchId,
        captainLogins: captainAliases,
      })
    ) {
      return res.status(409).json({
        error: 'Duplicate active registration',
        message: 'У капитана уже есть активная заявка на этот матч.',
      })
    }

    const registrationStatus = autoApproval?.status || 'PENDING'
    const created = await prisma.matchRegistration.create({
      data: {
        matchId,
        teamName: effectiveTeamName,
        captainName: effectiveCaptainName,
        captainLogin: effectiveCaptainLogin,
        cityId: match.stadium.cityId,
        stadiumId: match.stadiumId,
        note,
        playersCount: playersCount !== undefined ? Number(playersCount) : null,
        status: registrationStatus,
        teamId: effectiveTeamId,
      },
    })
    let teamId = effectiveTeamId
    if (registrationStatus === 'APPROVED') {
      teamId = await ensureTeamForRegistration(created)
    }
    const registration = await prisma.matchRegistration.findUnique({
      where: { id: created.id },
    })
    await syncMatchStatusByCapacity(matchId)
    res.status(201).json({
      ...registration,
      autoApproved: registrationStatus === 'APPROVED',
      teamId,
    })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Duplicate team name',
        message: 'На этот матч уже есть заявка с таким названием команды.',
      })
    }
    next(err)
  }
})

router.use('/', playerCardRouter)

export default router

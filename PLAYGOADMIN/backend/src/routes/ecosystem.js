import express from 'express'
import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  clubInclude,
  coachProfileInclude,
  favoriteClubInclude,
  normalizeClubTier,
  normalizeMediaUrl,
  normalizeSportCode,
  planInclude,
  serializeClub,
  serializeCoachProfile,
  serializePlan,
  serializeSport,
  serializeSubscription,
  subscriptionInclude,
  toNullableInt,
} from '../lib/ecosystem.js'
import {
  newsIncludeShape,
  normalizeNewsTypeFilter,
  recordNewsView,
  serializeNews,
} from '../lib/news.js'
import {
  notificationInclude,
  serializeFavoriteClub,
  serializeUserNotification,
  sortNewsWithFavoritesFirst,
} from '../lib/personalization.js'

const router = express.Router()

const daysFromNow = (days, start = new Date()) => {
  const result = new Date(start)
  result.setDate(result.getDate() + days)
  return result
}

const toBoolean = (value) => String(value || '').trim().toLowerCase() === 'true'

const getLimitedValue = (value, defaultValue, maxValue = 100) => {
  const parsed = toNullableInt(value)
  if (parsed == null) return defaultValue
  return Math.min(Math.max(parsed, 1), maxValue)
}

const getFavoriteClubIds = async (userId) => {
  const favorites = await prisma.favoriteClub.findMany({
    where: { userId },
    select: { clubId: true },
  })

  return favorites.map((favorite) => favorite.clubId)
}

router.get('/ecosystem', requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.sub
    const now = new Date()
    const soon = daysFromNow(7, now)
    const activeWhere = {
      userId,
      status: 'ACTIVE',
      expiresAt: { gt: now },
    }
    const expiringWhere = {
      ...activeWhere,
      expiresAt: { gt: now, lte: soon },
    }

    const [
      favoriteClubs,
      favoriteCount,
      unreadNotifications,
      membershipActiveCount,
      membershipExpiringCount,
      premiumActiveCount,
      premiumExpiringCount,
      recentNews,
      expiringMemberships,
      expiringPremium,
      unreadChatRows,
    ] = await Promise.all([
      prisma.favoriteClub.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 20,
        include: {
          club: {
            select: {
              id: true,
              name: true,
              address: true,
              imageUrl: true,
              logoUrl: true,
              tier: true,
              city: { select: { id: true, name: true } },
              sport: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      prisma.favoriteClub.count({ where: { userId } }),
      prisma.userNotification.count({ where: { userId, readAt: null } }),
      prisma.userSubscription.count({ where: activeWhere }),
      prisma.userSubscription.count({ where: expiringWhere }),
      prisma.appPremiumSubscription.count({ where: activeWhere }),
      prisma.appPremiumSubscription.count({ where: expiringWhere }),
      prisma.news.findMany({
        where: {
          club: { favoritedBy: { some: { userId } } },
          publishedAt: { lte: now },
        },
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        take: 10,
        select: {
          id: true,
          title: true,
          body: true,
          imageUrl: true,
          clubId: true,
          publishedAt: true,
          club: { select: { id: true, name: true } },
        },
      }),
      prisma.userSubscription.findMany({
        where: expiringWhere,
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        take: 10,
        select: {
          id: true,
          expiresAt: true,
          plan: { select: { id: true, title: true } },
          club: { select: { id: true, name: true } },
        },
      }),
      prisma.appPremiumSubscription.findMany({
        where: expiringWhere,
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        take: 10,
        select: {
          id: true,
          expiresAt: true,
          plan: { select: { id: true, title: true } },
        },
      }),
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS "count"
        FROM "DirectChat" AS chat
        WHERE (
          chat."userAId" = ${userId}
          OR chat."userBId" = ${userId}
        )
        AND EXISTS (
          SELECT 1
          FROM "ChatMessage" AS message
          WHERE message."chatId" = chat."id"
            AND message."senderUserId" <> ${userId}
            AND message."createdAt" > COALESCE(
              CASE
                WHEN chat."userAId" = ${userId} THEN chat."userALastReadAt"
                ELSE chat."userBLastReadAt"
              END,
              TIMESTAMP 'epoch'
            )
        )
      `,
    ])

    const expiringSubscriptions = [
      ...expiringMemberships.map((subscription) => ({
        id: subscription.id,
        kind: 'MEMBERSHIP',
        title: subscription.plan.title,
        expiresAt: subscription.expiresAt,
        club: subscription.club,
      })),
      ...expiringPremium.map((subscription) => ({
        id: subscription.id,
        kind: 'PREMIUM',
        title: subscription.plan.title,
        expiresAt: subscription.expiresAt,
        club: null,
      })),
    ]
      .sort(
        (left, right) =>
          new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime() ||
          left.id.localeCompare(right.id),
      )
      .slice(0, 10)

    res.json({
      favoriteClubs: favoriteClubs.map((favorite) => ({
        id: favorite.id,
        clubId: favorite.clubId,
        createdAt: favorite.createdAt,
        club: {
          ...favorite.club,
          imageUrl: normalizeMediaUrl(
            favorite.club.imageUrl || favorite.club.logoUrl,
          ),
          logoUrl: normalizeMediaUrl(
            favorite.club.logoUrl || favorite.club.imageUrl,
          ),
        },
      })),
      counts: {
        favoriteClubs: favoriteCount,
        unreadNotifications,
        unreadChats: Number(unreadChatRows[0]?.count || 0),
        activeSubscriptions: membershipActiveCount + premiumActiveCount,
        expiringSubscriptions:
          membershipExpiringCount + premiumExpiringCount,
      },
      highlights: {
        favoriteClubNews: recentNews.map((news) => ({
          ...news,
          imageUrl: normalizeMediaUrl(news.imageUrl),
        })),
        expiringSubscriptions,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.get('/sports', async (_req, res, next) => {
  try {
    const sports = await prisma.sport.findMany({ orderBy: { name: 'asc' } })
    res.json(sports.map(serializeSport))
  } catch (err) {
    next(err)
  }
})

router.get('/clubs', async (req, res, next) => {
  try {
    const age = toNullableInt(req.query.age)
    const sportCode = String(req.query.sportCode || '').trim().toUpperCase()
    const city = String(req.query.city || '').trim()
    const nameQuery = String(req.query.q || req.query.name || '').trim()
    const clubs = await prisma.sportClub.findMany({
      where: {
        sportId: req.query.sportId || undefined,
        sport: sportCode ? { code: sportCode } : undefined,
        cityId: req.query.cityId || undefined,
        tier: normalizeClubTier(req.query.tier, true) || undefined,
        city: city ? { name: { equals: city, mode: 'insensitive' } } : undefined,
        name: nameQuery ? { contains: nameQuery, mode: 'insensitive' } : undefined,
        AND:
          age == null
            ? undefined
            : [
                { OR: [{ minAge: null }, { minAge: { lte: age } }] },
                { OR: [{ maxAge: null }, { maxAge: { gte: age } }] },
              ],
      },
      orderBy: { name: 'asc' },
      include: clubInclude,
    })
    res.json(clubs.map(serializeClub))
  } catch (err) {
    next(err)
  }
})

/// Поиск карточек тренеров по городу клуба (`city` или `cityId`) и опционально виду спорта (`sportCode`).
router.get('/coach-profiles/search', async (req, res, next) => {
  try {
    const cityId = String(req.query.cityId || '').trim()
    const cityName = String(req.query.city || '').trim()
    const sportCodeRaw = req.query.sportCode
    const sportCode =
      typeof sportCodeRaw === 'string' && sportCodeRaw.trim()
        ? normalizeSportCode(sportCodeRaw)
        : ''
    const rawLimit = toNullableInt(req.query.limit)
    const limit =
      typeof rawLimit === 'number'
        ? Math.min(Math.max(rawLimit, 1), 50)
        : 24

    if (!cityId && !cityName) {
      return res.status(400).json({
        error: 'cityId or city is required',
        message: 'Укажите cityId города клуба или city (название).',
      })
    }

    const clubWhere = {}
    if (cityId) {
      clubWhere.cityId = cityId
    } else {
      clubWhere.city = { name: { equals: cityName, mode: 'insensitive' } }
    }
    if (sportCode) {
      clubWhere.sport = { code: sportCode }
    }

    const rows = await prisma.coachProfile.findMany({
      where: { club: clubWhere },
      orderBy: [{ experienceYears: 'desc' }, { createdAt: 'asc' }],
      take: limit,
      include: coachProfileInclude,
    })

    res.json({
      coaches: rows.map((row) => serializeCoachProfile(row)),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/clubs/:id', async (req, res, next) => {
  try {
    const club = await prisma.sportClub.findUnique({
      where: { id: req.params.id },
      include: clubInclude,
    })
    if (!club) return res.status(404).json({ error: 'Club not found' })
    res.json(serializeClub(club))
  } catch (err) {
    next(err)
  }
})

router.get('/me/favorite-clubs', requireAuth, async (req, res, next) => {
  try {
    const favorites = await prisma.favoriteClub.findMany({
      where: { userId: req.auth.sub },
      include: favoriteClubInclude,
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      favoriteClubs: favorites.map(serializeFavoriteClub),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/me/favorite-clubs', requireAuth, async (req, res, next) => {
  try {
    const clubId = String(req.body.clubId || '').trim()
    if (!clubId) return res.status(400).json({ error: 'clubId is required' })

    const club = await prisma.sportClub.findUnique({ where: { id: clubId } })
    if (!club) return res.status(404).json({ error: 'Club not found' })

    const favorite = await prisma.favoriteClub.upsert({
      where: {
        userId_clubId: {
          userId: req.auth.sub,
          clubId,
        },
      },
      update: {},
      create: {
        userId: req.auth.sub,
        clubId,
      },
      include: favoriteClubInclude,
    })

    res.status(201).json({
      favoriteClub: serializeFavoriteClub(favorite),
    })
  } catch (err) {
    next(err)
  }
})

router.delete('/me/favorite-clubs/:clubId', requireAuth, async (req, res, next) => {
  try {
    await prisma.favoriteClub.deleteMany({
      where: {
        userId: req.auth.sub,
        clubId: req.params.clubId,
      },
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.get('/me/news', requireAuth, async (req, res, next) => {
  try {
    const favoriteClubIds = await getFavoriteClubIds(req.auth.sub)
    const favoritesOnly = toBoolean(req.query.favoritesOnly)
    const limit = getLimitedValue(req.query.limit, 40, 100)
    const clubId = String(req.query.clubId || '').trim()
    const type = normalizeNewsTypeFilter(req.query.type)
    if (type === null) return res.status(400).json({ error: 'type is invalid' })

    if (favoritesOnly && favoriteClubIds.length === 0) {
      return res.json({ news: [] })
    }

    const fetchLimit = favoritesOnly ? limit : Math.min(Math.max(limit * 4, 50), 200)
    const rows = await prisma.news.findMany({
      where: {
        type: type || undefined,
        clubId: clubId || (favoritesOnly ? { in: favoriteClubIds } : undefined),
      },
      include: newsIncludeShape,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: fetchLimit,
    })

    const serialized = rows.map((row) => serializeNews(row, { favoriteClubIds }))
    const news = sortNewsWithFavoritesFirst(serialized).slice(0, limit)

    res.json({ news })
  } catch (err) {
    next(err)
  }
})

router.post('/me/news/:id/view', requireAuth, async (req, res, next) => {
  try {
    const news = await prisma.news.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    })
    if (!news) return res.status(404).json({ error: 'News not found' })
    res.json(await recordNewsView(news.id, req.auth.sub))
  } catch (err) {
    next(err)
  }
})

router.get('/me/notifications', requireAuth, async (req, res, next) => {
  try {
    const favoriteClubIds = await getFavoriteClubIds(req.auth.sub)
    const unreadOnly = toBoolean(req.query.unreadOnly)
    const type = String(req.query.type || '').trim()
    const limit = getLimitedValue(req.query.limit, 50, 100)

    const notifications = await prisma.userNotification.findMany({
      where: {
        userId: req.auth.sub,
        type: type || undefined,
        readAt: unreadOnly ? null : undefined,
      },
      include: notificationInclude,
      orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    })

    res.json({
      notifications: notifications.map((notification) =>
        serializeUserNotification(notification, { favoriteClubIds }),
      ),
    })
  } catch (err) {
    next(err)
  }
})

router.patch('/me/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.userNotification.findFirst({
      where: {
        id: req.params.id,
        userId: req.auth.sub,
      },
    })
    if (!existing) return res.status(404).json({ error: 'Notification not found' })

    const isRead = req.body.isRead === undefined ? true : Boolean(req.body.isRead)
    const notification = await prisma.userNotification.update({
      where: { id: existing.id },
      data: {
        readAt: isRead ? new Date() : null,
      },
      include: notificationInclude,
    })

    const favoriteClubIds = await getFavoriteClubIds(req.auth.sub)
    res.json({
      notification: serializeUserNotification(notification, { favoriteClubIds }),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/me/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    const now = new Date()
    const result = await prisma.userNotification.updateMany({
      where: {
        userId: req.auth.sub,
        readAt: null,
      },
      data: {
        readAt: now,
      },
    })

    res.json({
      updatedCount: result.count,
      readAt: now,
    })
  } catch (err) {
    next(err)
  }
})

router.get('/subscription-plans', async (req, res, next) => {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: {
        sportId: req.query.sportId || undefined,
        clubId: req.query.clubId || undefined,
        tier: normalizeClubTier(req.query.tier, true) || undefined,
        isActive: req.query.active === undefined ? true : String(req.query.active) === 'true',
      },
      orderBy: { priceCents: 'asc' },
      include: planInclude,
    })
    res.json(plans.map(serializePlan))
  } catch (err) {
    next(err)
  }
})

router.get('/me/subscriptions', requireAuth, async (req, res, next) => {
  try {
    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        userId: req.auth.sub,
        sportId: req.query.sportId || undefined,
        clubId: req.query.clubId || undefined,
        status: req.query.status || undefined,
      },
      orderBy: { expiresAt: 'desc' },
      include: subscriptionInclude,
    })
    res.json(subscriptions.map(serializeSubscription))
  } catch (err) {
    next(err)
  }
})

router.get('/me/subscriptions/notifications', requireAuth, async (req, res, next) => {
  try {
    const now = new Date()
    const soon = daysFromNow(7, now)
    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        userId: req.auth.sub,
        status: 'ACTIVE',
        expiresAt: { lte: soon, gte: now },
      },
      include: subscriptionInclude,
      orderBy: { expiresAt: 'asc' },
    })
    res.json({
      notifications: subscriptions.map((subscription) => ({
        type: 'SUBSCRIPTION_EXPIRING',
        title: 'Абонемент скоро закончится',
        body: `Абонемент "${subscription.plan.title}" действует до ${subscription.expiresAt.toISOString()}.`,
        subscription: serializeSubscription(subscription),
      })),
    })
  } catch (err) {
    next(err)
  }
})

export default router

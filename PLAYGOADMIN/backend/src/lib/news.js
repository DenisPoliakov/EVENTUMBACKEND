import prisma from '../prisma.js'
import { createNotificationWithPush } from './pushNotifications.js'

export const newsIncludeShape = {
  club: { include: { city: true, sport: true } },
  stadium: { include: { city: true } },
  match: { include: { stadium: { include: { city: true } } } },
  _count: {
    select: {
      views: true,
      uniqueViews: true,
    },
  },
}

const cmsTypeToPrisma = new Map([
  ['news', 'MANUAL'],
  ['manual', 'MANUAL'],
  ['sponsored', 'SPONSORED'],
])

export const normalizeNewsTypeFilter = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  const cmsType = cmsTypeToPrisma.get(raw.toLowerCase())
  if (cmsType) return cmsType
  const legacyType = raw.toUpperCase()
  return ['STADIUM_CREATED', 'MATCH_CREATED'].includes(legacyType)
    ? legacyType
    : null
}

const serializeNewsType = (type) => {
  if (type === 'MANUAL') return 'news'
  if (type === 'SPONSORED') return 'sponsored'
  return type
}

export const validateNewsPayload = (body, { partial = false } = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'payload must be a JSON object' }
  }

  const data = {}
  for (const [field, maxLength] of [
    ['title', 300],
    ['body', 20000],
  ]) {
    if (!partial || Object.hasOwn(body, field)) {
      const value = String(body[field] ?? '').trim()
      if (!value) return { error: `${field} is required` }
      if (value.length > maxLength) {
        return { error: `${field} must be at most ${maxLength} characters` }
      }
      data[field] = value
    }
  }

  if (Object.hasOwn(body, 'imageUrl')) {
    const imageUrl = String(body.imageUrl ?? '').trim()
    if (imageUrl.length > 2000) {
      return { error: 'imageUrl must be at most 2000 characters' }
    }
    data.imageUrl = imageUrl || null
  }

  if (!partial || Object.hasOwn(body, 'type')) {
    const type = String(body.type ?? 'news').trim().toLowerCase()
    const normalized = cmsTypeToPrisma.get(type)
    if (!normalized) return { error: 'type must be news or sponsored' }
    data.type = normalized
  }

  // TEMP: привязка новостей к клубу отключена — раскомментировать блок ниже, чтобы вернуть.
  // if (Object.hasOwn(body, 'clubId')) {
  //   const clubId = String(body.clubId ?? '').trim()
  //   if (clubId.length > 120) {
  //     return { error: 'clubId must be at most 120 characters' }
  //   }
  //   data.clubId = clubId || null
  // }
  if (Object.hasOwn(body, 'clubId') || !partial) {
    data.clubId = null
  }

  if (Object.hasOwn(body, 'publishedAt')) {
    if (body.publishedAt === null || body.publishedAt === '') {
      data.publishedAt = new Date()
    } else {
      const publishedAt = new Date(body.publishedAt)
      if (Number.isNaN(publishedAt.getTime())) {
        return { error: 'publishedAt must be an ISO 8601 timestamp' }
      }
      data.publishedAt = publishedAt
    }
  }

  return { data }
}

export async function createNews({
  title,
  body,
  imageUrl,
  type = 'MANUAL',
  clubId,
  stadiumId,
  matchId,
  publishedAt,
}) {
  const news = await prisma.news.create({
    data: {
      title,
      body,
      imageUrl: imageUrl || null,
      type,
      clubId: clubId || null,
      stadiumId: stadiumId || null,
      matchId: matchId || null,
      publishedAt: publishedAt ? new Date(publishedAt) : undefined,
    },
    include: newsIncludeShape,
  })

  if (news.clubId) {
    const favorites = await prisma.favoriteClub.findMany({
      where: { clubId: news.clubId },
      select: { userId: true },
    })

    if (favorites.length) {
      const preview =
        news.body.length > 140 ? `${news.body.slice(0, 137).trim()}…` : news.body
      await Promise.all(
        favorites.map((favorite) =>
          createNotificationWithPush({
            userId: favorite.userId,
            type: 'FAVORITE_CLUB_NEWS',
            title: news.title,
            body: preview,
            imageUrl: news.imageUrl || null,
            clubId: news.clubId,
            newsId: news.id,
            dedupeKey: `favorite-club-news:${news.id}:${favorite.userId}`,
            data: { newsId: news.id, clubId: news.clubId },
          }),
        ),
      )
    }
  }

  return news
}

export async function syncNewsNotifications(news) {
  return prisma.userNotification.updateMany({
    where: { newsId: news.id },
    data: {
      title: news.title,
      body: news.body,
      imageUrl: news.imageUrl || null,
      clubId: news.clubId || null,
    },
  })
}

export const serializeNews = (item, options = {}) => {
  const favoriteClubIds = new Set(options.favoriteClubIds || [])
  const isFavoriteClubNews = Boolean(item.clubId && favoriteClubIds.has(item.clubId))

  return {
    id: item.id,
    title: item.title,
    body: item.body,
    imageUrl: item.imageUrl || '',
    type: serializeNewsType(item.type),
    clubId: item.clubId || '',
    stadiumId: item.stadiumId || '',
    matchId: item.matchId || '',
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    viewCount: item._count?.views ?? 0,
    uniqueViewerCount: item._count?.uniqueViews ?? 0,
    isFavoriteClubNews,
    club: item.club
      ? {
          id: item.club.id,
          name: item.club.name,
          city: item.club.city?.name || '',
          sport: item.club.sport
            ? {
                id: item.club.sport.id,
                code: item.club.sport.code,
                name: item.club.sport.name,
              }
            : null,
        }
      : null,
    stadium: item.stadium
      ? {
          id: item.stadium.id,
          name: item.stadium.name,
          city: item.stadium.city?.name || '',
        }
      : null,
    match: item.match
      ? {
          id: item.match.id,
          startTime: item.match.startTime,
          status: item.match.status,
          format: item.match.format,
          stadium: item.match.stadium
            ? {
                id: item.match.stadium.id,
                name: item.match.stadium.name,
                city: item.match.stadium.city?.name || '',
              }
            : null,
        }
      : null,
  }
}

export const recordNewsView = async (newsId, userId) => {
  const [, uniqueResult] = await prisma.$transaction([
    prisma.newsView.create({
      data: { newsId, userId },
    }),
    prisma.newsUniqueView.createMany({
      data: [{ newsId, userId }],
      skipDuplicates: true,
    }),
  ])

  const [viewCount, uniqueViewerCount] = await Promise.all([
    prisma.newsView.count({ where: { newsId } }),
    prisma.newsUniqueView.count({ where: { newsId } }),
  ])

  return {
    newsId,
    viewCount,
    uniqueViewerCount,
    isFirstViewByUser: uniqueResult.count === 1,
  }
}

import prisma from '../prisma.js'

export const newsIncludeShape = {
  club: { include: { city: true, sport: true } },
  stadium: { include: { city: true } },
  match: { include: { stadium: { include: { city: true } } } },
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
      await prisma.userNotification.createMany({
        data: favorites.map((favorite) => ({
          userId: favorite.userId,
          type: 'FAVORITE_CLUB_NEWS',
          title: news.title,
          body: news.body,
          imageUrl: news.imageUrl || null,
          clubId: news.clubId,
          newsId: news.id,
        })),
      })
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
    type: item.type,
    clubId: item.clubId || '',
    stadiumId: item.stadiumId || '',
    matchId: item.matchId || '',
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
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

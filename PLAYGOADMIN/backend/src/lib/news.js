import prisma from '../prisma.js'

export const createNews = async ({
  title,
  body,
  imageUrl,
  type = 'MANUAL',
  stadiumId,
  matchId,
  publishedAt,
}) =>
  prisma.news.create({
    data: {
      title,
      body,
      imageUrl: imageUrl || null,
      type,
      stadiumId: stadiumId || null,
      matchId: matchId || null,
      publishedAt: publishedAt ? new Date(publishedAt) : undefined,
    },
    include: {
      stadium: { include: { city: true } },
      match: { include: { stadium: { include: { city: true } } } },
    },
  })

export const serializeNews = (item) => ({
  id: item.id,
  title: item.title,
  body: item.body,
  imageUrl: item.imageUrl || '',
  type: item.type,
  stadiumId: item.stadiumId || '',
  matchId: item.matchId || '',
  publishedAt: item.publishedAt,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
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
})

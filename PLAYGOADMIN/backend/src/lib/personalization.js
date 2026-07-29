import { clubInclude, favoriteClubInclude, serializeClub } from './ecosystem.js'
import { newsIncludeShape, serializeNews } from './news.js'

export const personalizedNewsInclude = newsIncludeShape

export const favoriteClubListInclude = favoriteClubInclude

export const notificationInclude = {
  club: {
    include: clubInclude,
  },
  news: {
    include: newsIncludeShape,
  },
}

export const serializeFavoriteClub = (favorite) => ({
  id: favorite.id,
  userId: favorite.userId,
  clubId: favorite.clubId,
  createdAt: favorite.createdAt,
  club: favorite.club ? serializeClub(favorite.club) : null,
})

export const sortNewsWithFavoritesFirst = (items) =>
  [...items].sort((left, right) => {
    if (Boolean(left.isFavoriteClubNews) !== Boolean(right.isFavoriteClubNews)) {
      return left.isFavoriteClubNews ? -1 : 1
    }

    const rightPublished = new Date(right.publishedAt || right.createdAt || 0).getTime()
    const leftPublished = new Date(left.publishedAt || left.createdAt || 0).getTime()
    return rightPublished - leftPublished
  })

export const serializeUserNotification = (notification, options = {}) => {
  const favoriteClubIds = options.favoriteClubIds || []

  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    imageUrl: notification.imageUrl || '',
    clubId: notification.clubId || '',
    newsId: notification.newsId || '',
    data: notification.data || {},
    isRead: Boolean(notification.readAt),
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
    club: notification.club ? serializeClub(notification.club) : null,
    news: notification.news
      ? serializeNews(notification.news, { favoriteClubIds })
      : null,
  }
}

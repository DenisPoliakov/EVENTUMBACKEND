import prisma from '../prisma.js'

export const REVIEW_RATING_MIN = 1
export const REVIEW_RATING_MAX = 5
export const REVIEW_BODY_MAX = 2000

const authorSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
}

export const reviewInclude = {
  author: { select: authorSelect },
}

export const serializeReviewAuthor = (user) => {
  if (!user) return null
  const photoUrl = user.avatarUrl || ''
  return {
    id: user.id,
    username: user.username || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    avatarUrl: photoUrl,
    photoUrl,
  }
}

export const serializeReview = (review) => ({
  id: review.id,
  targetType: String(review.targetType || '').toLowerCase(),
  clubId: review.clubId || null,
  coachProfileId: review.coachProfileId || null,
  rating: review.rating,
  body: review.body || '',
  authorUserId: review.authorUserId,
  author: serializeReviewAuthor(review.author),
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
})

export const roundAverageRating = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null
  }
  return Math.round(Number(value) * 10) / 10
}

export const getClubReviewSummary = async (clubId) => {
  const agg = await prisma.review.aggregate({
    where: {
      clubId,
      targetType: 'CLUB',
      isHidden: false,
    },
    _avg: { rating: true },
    _count: { _all: true },
  })
  return {
    averageRating: roundAverageRating(agg._avg.rating),
    reviewCount: agg._count._all,
  }
}

export const getCoachReviewSummary = async (coachProfileId) => {
  const agg = await prisma.review.aggregate({
    where: {
      coachProfileId,
      targetType: 'COACH',
      isHidden: false,
    },
    _avg: { rating: true },
    _count: { _all: true },
  })
  return {
    averageRating: roundAverageRating(agg._avg.rating),
    reviewCount: agg._count._all,
  }
}

export const parseReviewPayload = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('payload must be a JSON object')
    error.statusCode = 400
    throw error
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < REVIEW_RATING_MIN || rating > REVIEW_RATING_MAX) {
    const error = new Error(
      `rating must be an integer between ${REVIEW_RATING_MIN} and ${REVIEW_RATING_MAX}`,
    )
    error.statusCode = 400
    throw error
  }

  const bodyText = String(body.body ?? body.text ?? '').trim()
  if (!bodyText) {
    const error = new Error('body is required')
    error.statusCode = 400
    throw error
  }
  if (bodyText.length > REVIEW_BODY_MAX) {
    const error = new Error(`body must be at most ${REVIEW_BODY_MAX} characters`)
    error.statusCode = 400
    throw error
  }

  return { rating, body: bodyText }
}

export const listReviews = async ({ clubId, coachProfileId, limit = 50, before }) => {
  const where = {
    isHidden: false,
    ...(clubId
      ? { clubId, targetType: 'CLUB' }
      : { coachProfileId, targetType: 'COACH' }),
    ...(before ? { createdAt: { lt: before } } : {}),
  }

  const reviews = await prisma.review.findMany({
    where,
    include: reviewInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const summary = clubId
    ? await getClubReviewSummary(clubId)
    : await getCoachReviewSummary(coachProfileId)

  return {
    reviews: reviews.map(serializeReview),
    summary,
  }
}

export const upsertClubReview = async ({ authorUserId, clubId, rating, body }) => {
  const club = await prisma.sportClub.findUnique({
    where: { id: clubId },
    select: { id: true },
  })
  if (!club) {
    const error = new Error('Club not found')
    error.statusCode = 404
    throw error
  }

  const review = await prisma.review.upsert({
    where: {
      authorUserId_clubId: { authorUserId, clubId },
    },
    create: {
      authorUserId,
      targetType: 'CLUB',
      clubId,
      coachProfileId: null,
      rating,
      body,
    },
    update: {
      rating,
      body,
      isHidden: false,
      targetType: 'CLUB',
    },
    include: reviewInclude,
  })

  return {
    review: serializeReview(review),
    summary: await getClubReviewSummary(clubId),
  }
}

export const upsertCoachReview = async ({
  authorUserId,
  coachProfileId,
  rating,
  body,
}) => {
  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true },
  })
  if (!coach) {
    const error = new Error('Coach profile not found')
    error.statusCode = 404
    throw error
  }

  const review = await prisma.review.upsert({
    where: {
      authorUserId_coachProfileId: { authorUserId, coachProfileId },
    },
    create: {
      authorUserId,
      targetType: 'COACH',
      coachProfileId,
      clubId: null,
      rating,
      body,
    },
    update: {
      rating,
      body,
      isHidden: false,
      targetType: 'COACH',
    },
    include: reviewInclude,
  })

  return {
    review: serializeReview(review),
    summary: await getCoachReviewSummary(coachProfileId),
  }
}

export const deleteOwnReview = async ({ reviewId, authorUserId }) => {
  const existing = await prisma.review.findFirst({
    where: { id: reviewId, authorUserId },
  })
  if (!existing) {
    const error = new Error('Review not found')
    error.statusCode = 404
    throw error
  }
  await prisma.review.delete({ where: { id: existing.id } })
  return existing
}

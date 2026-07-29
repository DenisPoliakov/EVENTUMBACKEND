import prisma from '../prisma.js'

export const WELLNESS_STORY_CATEGORIES = [
  'nutrition',
  'warmup',
  'routine',
  'workouts',
  'balance',
]

const categoryToPrisma = new Map(
  WELLNESS_STORY_CATEGORIES.map((category) => [category, category.toUpperCase()])
)

export const wellnessStoryCountInclude = {
  _count: {
    select: {
      views: true,
    },
  },
}

export const publicWellnessStoryWhere = (now = new Date()) => ({
  locale: 'ru',
  isActive: true,
  deletedAt: null,
  publishedAt: { lte: now },
})

export const wellnessStoryIdentifierWhere = (identifier) => ({
  OR: [{ id: identifier }, { slug: identifier }],
})

export const serializeWellnessStory = (
  story,
  { viewedByMe = false, includeAdminFields = false } = {}
) => {
  const serialized = {
    id: story.id,
    slug: story.slug || null,
    title: story.title,
    body: story.body,
    category: String(story.category || '').toLowerCase(),
    coverImageUrl: story.coverImageUrl || null,
    readMinutes: story.readMinutes,
    sortOrder: story.sortOrder,
    locale: story.locale,
    publishedAt: story.publishedAt,
    uniqueViewerCount: story._count?.views ?? 0,
    viewedByMe: Boolean(viewedByMe),
  }

  if (!includeAdminFields) return serialized

  return {
    ...serialized,
    isActive: Boolean(story.isActive),
    deletedAt: story.deletedAt || null,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
  }
}

const parseInteger = (value, field, { min, max }) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { error: `${field} must be an integer between ${min} and ${max}` }
  }
  return { value: parsed }
}

export const validateWellnessStoryPayload = (body, { partial = false } = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'payload must be a JSON object' }
  }

  const data = {}

  if (Object.hasOwn(body, 'slug')) {
    const slug = String(body.slug ?? '').trim().toLowerCase()
    if (!slug) {
      data.slug = null
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
      return {
        error:
          'slug must be at most 120 lowercase Latin letters, numbers, and single hyphens',
      }
    } else {
      data.slug = slug
    }
  }

  for (const field of ['title', 'body']) {
    if (!partial || Object.hasOwn(body, field)) {
      const value = String(body[field] ?? '').trim()
      if (!value) return { error: `${field} is required` }
      data[field] = value
    }
  }

  if (!partial || Object.hasOwn(body, 'category')) {
    const category = String(body.category ?? '').trim().toLowerCase()
    const normalized = categoryToPrisma.get(category)
    if (!normalized) return { error: 'category is invalid' }
    data.category = normalized
  }

  if (Object.hasOwn(body, 'coverImageUrl')) {
    data.coverImageUrl = String(body.coverImageUrl ?? '').trim() || null
  }

  if (!partial || Object.hasOwn(body, 'readMinutes')) {
    const result = parseInteger(body.readMinutes ?? 3, 'readMinutes', {
      min: 1,
      max: 120,
    })
    if (result.error) return result
    data.readMinutes = result.value
  }

  if (!partial || Object.hasOwn(body, 'sortOrder')) {
    const result = parseInteger(body.sortOrder ?? 0, 'sortOrder', {
      min: -10000,
      max: 10000,
    })
    if (result.error) return result
    data.sortOrder = result.value
  }

  if (Object.hasOwn(body, 'locale')) {
    const locale = String(body.locale ?? '').trim().toLowerCase()
    if (locale !== 'ru') return { error: 'locale must be ru' }
    data.locale = 'ru'
  } else if (!partial) {
    data.locale = 'ru'
  }

  if (Object.hasOwn(body, 'publishedAt')) {
    if (body.publishedAt === null || body.publishedAt === '') {
      data.publishedAt = new Date()
    } else {
      const publishedAt = new Date(body.publishedAt)
      if (Number.isNaN(publishedAt.getTime())) {
        return { error: 'publishedAt is invalid' }
      }
      data.publishedAt = publishedAt
    }
  }

  if (Object.hasOwn(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') {
      return { error: 'isActive must be a boolean' }
    }
    data.isActive = body.isActive
  }

  return { data }
}

export const recordWellnessStoryView = async (storyId, userId) => {
  let isFirstViewByUser = false

  try {
    await prisma.wellnessStoryView.create({
      data: {
        storyId,
        userId,
      },
    })
    isFirstViewByUser = true
  } catch (err) {
    if (err.code !== 'P2002') throw err
  }

  const uniqueViewerCount = await prisma.wellnessStoryView.count({
    where: { storyId },
  })

  return {
    storyId,
    uniqueViewerCount,
    isFirstViewByUser,
  }
}

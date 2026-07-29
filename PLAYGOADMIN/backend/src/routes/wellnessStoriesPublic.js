import express from 'express'

import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { optionalAuth } from '../middleware/optionalAuth.js'
import {
  publicWellnessStoryWhere,
  recordWellnessStoryView,
  serializeWellnessStory,
  wellnessStoryCountInclude,
  wellnessStoryIdentifierWhere,
} from '../lib/wellnessStories.js'

const router = express.Router()

const parseLimit = (value) => {
  if (value === undefined || value === '') return { value: 50 }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return { error: 'limit must be a positive integer' }
  }
  return { value: Math.min(parsed, 100) }
}

router.get('/wellness-stories', optionalAuth, async (req, res, next) => {
  try {
    const locale = String(req.query.locale || 'ru').trim().toLowerCase()
    if (locale !== 'ru') {
      return res.status(400).json({ error: 'locale must be ru' })
    }

    const limit = parseLimit(req.query.limit)
    if (limit.error) return res.status(400).json({ error: limit.error })

    const stories = await prisma.wellnessStory.findMany({
      where: publicWellnessStoryWhere(),
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      take: limit.value,
      include: wellnessStoryCountInclude,
    })

    let viewedStoryIds = new Set()
    if (req.auth?.sub && stories.length > 0) {
      const views = await prisma.wellnessStoryView.findMany({
        where: {
          userId: req.auth.sub,
          storyId: { in: stories.map((story) => story.id) },
        },
        select: { storyId: true },
      })
      viewedStoryIds = new Set(views.map((view) => view.storyId))
    }

    res.json({
      stories: stories.map((story) =>
        serializeWellnessStory(story, {
          viewedByMe: viewedStoryIds.has(story.id),
        })
      ),
    })
  } catch (err) {
    next(err)
  }
})

router.get(
  '/wellness-stories/:identifier',
  optionalAuth,
  async (req, res, next) => {
    try {
      const story = await prisma.wellnessStory.findFirst({
        where: {
          ...wellnessStoryIdentifierWhere(req.params.identifier),
          ...publicWellnessStoryWhere(),
        },
        include: wellnessStoryCountInclude,
      })
      if (!story) {
        return res.status(404).json({ error: 'Wellness story not found' })
      }

      const viewedByMe = req.auth?.sub
        ? Boolean(
            await prisma.wellnessStoryView.findUnique({
              where: {
                storyId_userId: {
                  storyId: story.id,
                  userId: req.auth.sub,
                },
              },
              select: { id: true },
            })
          )
        : false

      res.json(serializeWellnessStory(story, { viewedByMe }))
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/me/wellness-stories/:identifier/view',
  requireAuth,
  async (req, res, next) => {
    try {
      const story = await prisma.wellnessStory.findFirst({
        where: {
          ...wellnessStoryIdentifierWhere(req.params.identifier),
          ...publicWellnessStoryWhere(),
        },
        select: { id: true },
      })
      if (!story) {
        return res.status(404).json({ error: 'Wellness story not found' })
      }

      const result = await recordWellnessStoryView(story.id, req.auth.sub)
      res.json(result)
    } catch (err) {
      next(err)
    }
  }
)

export default router

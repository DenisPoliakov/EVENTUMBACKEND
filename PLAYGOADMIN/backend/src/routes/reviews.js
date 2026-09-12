import express from 'express'

import { requireAuth } from '../middleware/requireAuth.js'
import {
  deleteOwnReview,
  listReviews,
  parseReviewPayload,
  upsertClubReview,
  upsertCoachReview,
} from '../lib/reviews.js'

const router = express.Router()

const listLimit = (value, fallback = 50, max = 100) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 1), max)
}

const parseBefore = (value) => {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    const error = new Error('before must be a valid ISO date')
    error.statusCode = 400
    throw error
  }
  return date
}

router.get('/clubs/:clubId/reviews', async (req, res, next) => {
  try {
    const result = await listReviews({
      clubId: req.params.clubId,
      limit: listLimit(req.query.limit),
      before: parseBefore(req.query.before),
    })
    res.json(result)
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.get('/coach-profiles/:coachProfileId/reviews', async (req, res, next) => {
  try {
    const result = await listReviews({
      coachProfileId: req.params.coachProfileId,
      limit: listLimit(req.query.limit),
      before: parseBefore(req.query.before),
    })
    res.json(result)
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.post('/me/clubs/:clubId/reviews', requireAuth, async (req, res, next) => {
  try {
    const payload = parseReviewPayload(req.body)
    const result = await upsertClubReview({
      authorUserId: req.auth.sub,
      clubId: req.params.clubId,
      ...payload,
    })
    res.status(201).json(result)
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.post(
  '/me/coach-profiles/:coachProfileId/reviews',
  requireAuth,
  async (req, res, next) => {
    try {
      const payload = parseReviewPayload(req.body)
      const result = await upsertCoachReview({
        authorUserId: req.auth.sub,
        coachProfileId: req.params.coachProfileId,
        ...payload,
      })
      res.status(201).json(result)
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
      next(err)
    }
  },
)

router.delete('/me/reviews/:reviewId', requireAuth, async (req, res, next) => {
  try {
    await deleteOwnReview({
      reviewId: req.params.reviewId,
      authorUserId: req.auth.sub,
    })
    res.status(204).send()
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

export default router

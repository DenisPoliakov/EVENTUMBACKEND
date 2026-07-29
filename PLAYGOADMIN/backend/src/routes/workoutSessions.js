import express from 'express'

import prisma from '../prisma.js'
import {
  createWorkoutSessionServerWins,
  serializeWorkoutSession,
  validateWorkoutSessionPayload,
} from '../lib/workoutSessions.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

const parseQueryTimestamp = (value, field) => {
  if (value === undefined || value === '') return { value: undefined }
  if (typeof value !== 'string') {
    return { error: `${field} must be an ISO 8601 timestamp` }
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return { error: `${field} must be an ISO 8601 timestamp` }
  }
  return { value: parsed }
}

const validateProgramIds = async (items) => {
  const programIds = [...new Set(items.map((item) => item.programId))]
  const programs = await prisma.workoutProgram.findMany({
    where: { id: { in: programIds } },
    select: { id: true },
  })
  const foundIds = new Set(programs.map((program) => program.id))
  return programIds.filter((id) => !foundIds.has(id))
}

router.get('/me/workout-sessions', requireAuth, async (req, res, next) => {
  try {
    const from = parseQueryTimestamp(req.query.from, 'from')
    if (from.error) return res.status(400).json({ error: from.error })
    const to = parseQueryTimestamp(req.query.to, 'to')
    if (to.error) return res.status(400).json({ error: to.error })
    if (from.value && to.value && from.value > to.value) {
      return res.status(400).json({ error: 'from must not be after to' })
    }

    const rawLimit = req.query.limit === undefined ? 100 : Number(req.query.limit)
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 500) {
      return res
        .status(400)
        .json({ error: 'limit must be an integer between 1 and 500' })
    }

    const sessions = await prisma.workoutSession.findMany({
      where: {
        userId: req.auth.sub,
        finishedAt:
          from.value || to.value
            ? {
                gte: from.value,
                lte: to.value,
              }
            : undefined,
      },
      orderBy: [{ finishedAt: 'desc' }, { id: 'desc' }],
      take: rawLimit,
    })
    res.json({ sessions: sessions.map(serializeWorkoutSession) })
  } catch (err) {
    next(err)
  }
})

router.post('/me/workout-sessions', requireAuth, async (req, res, next) => {
  try {
    const validated = validateWorkoutSessionPayload(req.body)
    if (validated.error) {
      return res.status(400).json({ error: validated.error })
    }
    const missingProgramIds = await validateProgramIds([validated.data])
    if (missingProgramIds.length) {
      return res.status(400).json({
        error: 'programId does not reference an existing workout program',
        programId: missingProgramIds[0],
      })
    }

    const result = await createWorkoutSessionServerWins(
      req.auth.sub,
      validated.data
    )
    res
      .status(result.created ? 201 : 200)
      .json(serializeWorkoutSession(result.session))
  } catch (err) {
    next(err)
  }
})

router.post(
  '/me/workout-sessions/bulk',
  requireAuth,
  async (req, res, next) => {
    try {
      if (!Array.isArray(req.body?.sessions)) {
        return res.status(400).json({ error: 'sessions must be an array' })
      }
      if (req.body.sessions.length < 1 || req.body.sessions.length > 500) {
        return res
          .status(400)
          .json({ error: 'sessions must contain between 1 and 500 items' })
      }

      const items = []
      for (let index = 0; index < req.body.sessions.length; index += 1) {
        const validated = validateWorkoutSessionPayload(
          req.body.sessions[index]
        )
        if (validated.error) {
          return res.status(400).json({
            error: `sessions[${index}]: ${validated.error}`,
          })
        }
        items.push(validated.data)
      }

      const missingProgramIds = await validateProgramIds(items)
      if (missingProgramIds.length) {
        return res.status(400).json({
          error: 'One or more programId values do not reference existing workout programs',
          programIds: missingProgramIds,
        })
      }

      const results = []
      for (const item of items) {
        results.push(
          await createWorkoutSessionServerWins(req.auth.sub, item)
        )
      }

      const createdCount = results.filter((result) => result.created).length
      res.json({
        createdCount,
        existingCount: results.length - createdCount,
        sessions: results.map((result) =>
          serializeWorkoutSession(result.session)
        ),
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router

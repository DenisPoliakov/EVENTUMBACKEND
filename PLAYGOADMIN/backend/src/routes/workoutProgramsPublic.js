import express from 'express'

import prisma from '../prisma.js'
import {
  publicWorkoutProgramWhere,
  recordWorkoutProgramView,
  serializeWorkoutProgram,
  serializeWorkoutStep,
  workoutProgramDetailInclude,
  workoutProgramInclude,
} from '../lib/workoutPrograms.js'
import { optionalAuth } from '../middleware/optionalAuth.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

const viewedProgramIdsFor = async (userId, programIds) => {
  if (!userId || programIds.length === 0) return new Set()
  const views = await prisma.workoutProgramView.findMany({
    where: {
      userId,
      programId: { in: programIds },
    },
    select: { programId: true },
  })
  return new Set(views.map((view) => view.programId))
}

router.get('/workout-programs', optionalAuth, async (req, res, next) => {
  try {
    const locale = String(req.query.locale || 'ru').trim().toLowerCase()
    if (locale !== 'ru') {
      return res.status(400).json({ error: 'locale must be ru' })
    }

    const programs = await prisma.workoutProgram.findMany({
      where: publicWorkoutProgramWhere,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: workoutProgramInclude,
    })
    const viewedIds = await viewedProgramIdsFor(
      req.auth?.sub,
      programs.map((program) => program.id)
    )

    res.json({
      programs: programs.map((program) =>
        serializeWorkoutProgram(program, {
          viewedByMe: viewedIds.has(program.id),
        })
      ),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/workout-programs/:id/steps', optionalAuth, async (req, res, next) => {
  try {
    const program = await prisma.workoutProgram.findFirst({
      where: {
        id: req.params.id,
        ...publicWorkoutProgramWhere,
      },
      select: {
        id: true,
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!program) {
      return res.status(404).json({ error: 'Workout program not found' })
    }

    const totalDurationSeconds = program.steps.reduce(
      (total, step) => total + step.durationSeconds,
      0
    )
    res.json({
      programId: program.id,
      stepCount: program.steps.length,
      totalDurationSeconds,
      steps: program.steps.map(serializeWorkoutStep),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/workout-programs/:id', optionalAuth, async (req, res, next) => {
  try {
    const program = await prisma.workoutProgram.findFirst({
      where: {
        id: req.params.id,
        ...publicWorkoutProgramWhere,
      },
      include: workoutProgramDetailInclude,
    })
    if (!program) {
      return res.status(404).json({ error: 'Workout program not found' })
    }

    const viewedIds = await viewedProgramIdsFor(req.auth?.sub, [program.id])
    res.json(
      serializeWorkoutProgram(program, {
        viewedByMe: viewedIds.has(program.id),
      })
    )
  } catch (err) {
    next(err)
  }
})

router.post(
  '/me/workout-programs/:id/view',
  requireAuth,
  async (req, res, next) => {
    try {
      const program = await prisma.workoutProgram.findFirst({
        where: {
          id: req.params.id,
          ...publicWorkoutProgramWhere,
        },
        select: { id: true },
      })
      if (!program) {
        return res.status(404).json({ error: 'Workout program not found' })
      }

      res.json(await recordWorkoutProgramView(program.id, req.auth.sub))
    } catch (err) {
      next(err)
    }
  }
)

export default router

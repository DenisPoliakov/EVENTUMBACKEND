import express from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'

import prisma from '../prisma.js'
import {
  serializeWorkoutProgram,
  serializeWorkoutStep,
  validateWorkoutProgramPayload,
  validateWorkoutStepPayload,
  workoutProgramDetailInclude,
  workoutProgramInclude,
} from '../lib/workoutPrograms.js'

const router = express.Router()
const uploadsRoot = path.join(process.cwd(), 'public', 'uploads', 'workouts')
fs.mkdirSync(uploadsRoot, { recursive: true })

const imageExtensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
])

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.params.id)) {
      return cb(new Error('Invalid workout program id'))
    }
    const directory = path.join(uploadsRoot, req.params.id)
    fs.mkdir(directory, { recursive: true }, (err) => cb(err, directory))
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${imageExtensions.get(file.mimetype) || '.jpg'}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!imageExtensions.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'))
    }
    cb(null, true)
  },
})

const uploadIllustration = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must not exceed 5 MB'
        : err.message || 'Invalid image'
    return res.status(400).json({ error: message })
  })
}

const removeUploadedFile = async (url) => {
  const prefix = '/uploads/workouts/'
  if (!url?.startsWith(prefix)) return
  const target = path.resolve(uploadsRoot, url.slice(prefix.length))
  const safeRoot = `${path.resolve(uploadsRoot)}${path.sep}`
  if (!target.startsWith(safeRoot)) return
  try {
    await fs.promises.unlink(target)
    await fs.promises.rmdir(path.dirname(target)).catch(() => {})
  } catch {
    // Missing or externally managed files require no cleanup.
  }
}

const serializeAdminProgram = (program, { includeSteps = false } = {}) =>
  serializeWorkoutProgram(program, {
    includeAdminFields: true,
    includeSteps,
  })

const handleConflict = (err, res, next) => {
  if (err.code === 'P2002') {
    const target = String(err.meta?.target || '')
    if (target.includes('id')) {
      return res.status(409).json({ error: 'Workout program id is already in use' })
    }
    return res.status(409).json({ error: 'Step order is already in use' })
  }
  return next(err)
}

router.get('/', async (_req, res, next) => {
  try {
    const programs = await prisma.workoutProgram.findMany({
      where: { locale: 'ru' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: workoutProgramInclude,
    })
    res.json(programs.map((program) => serializeAdminProgram(program)))
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const parsed = validateWorkoutProgramPayload(req.body)
    if (parsed.error) return res.status(400).json({ error: parsed.error })

    const program = await prisma.workoutProgram.create({
      data: parsed.data,
      include: workoutProgramDetailInclude,
    })
    res.status(201).json(serializeAdminProgram(program, { includeSteps: true }))
  } catch (err) {
    handleConflict(err, res, next)
  }
})

router.put('/:id/steps/reorder', async (req, res, next) => {
  try {
    const stepIds = req.body?.stepIds
    if (!Array.isArray(stepIds) || stepIds.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'stepIds must be an array of strings' })
    }
    if (new Set(stepIds).size !== stepIds.length) {
      return res.status(400).json({ error: 'stepIds must not contain duplicates' })
    }

    const steps = await prisma.$transaction(
      async (tx) => {
        const program = await tx.workoutProgram.findUnique({
          where: { id: req.params.id },
          select: { id: true },
        })
        if (!program) return null

        const existing = await tx.workoutStep.findMany({
          where: { programId: program.id },
          orderBy: { order: 'asc' },
          select: { id: true, order: true },
        })
        const existingIds = new Set(existing.map((step) => step.id))
        if (
          existing.length !== stepIds.length ||
          stepIds.some((id) => !existingIds.has(id))
        ) {
          const error = new Error(
            'stepIds must contain every program step exactly once'
          )
          error.status = 400
          throw error
        }

        const temporaryBase =
          Math.max(10000, ...existing.map((step) => step.order)) +
          existing.length +
          1
        for (const [index, stepId] of stepIds.entries()) {
          await tx.workoutStep.update({
            where: { id: stepId },
            data: { order: temporaryBase + index },
          })
        }
        for (const [index, stepId] of stepIds.entries()) {
          await tx.workoutStep.update({
            where: { id: stepId },
            data: { order: index + 1 },
          })
        }
        return tx.workoutStep.findMany({
          where: { programId: program.id },
          orderBy: { order: 'asc' },
        })
      },
      { isolationLevel: 'Serializable' }
    )

    if (!steps) {
      return res.status(404).json({ error: 'Workout program not found' })
    }
    res.json({ steps: steps.map(serializeWorkoutStep) })
  } catch (err) {
    next(err)
  }
})

router.get('/:id/steps', async (req, res, next) => {
  try {
    const program = await prisma.workoutProgram.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        steps: { orderBy: { order: 'asc' } },
      },
    })
    if (!program) {
      return res.status(404).json({ error: 'Workout program not found' })
    }
    res.json({ steps: program.steps.map(serializeWorkoutStep) })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/steps', async (req, res, next) => {
  try {
    const parsed = validateWorkoutStepPayload(req.body)
    if (parsed.error) return res.status(400).json({ error: parsed.error })

    const step = await prisma.$transaction(async (tx) => {
      const program = await tx.workoutProgram.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      })
      if (!program) return null

      let order = parsed.data.order
      if (order === undefined) {
        const last = await tx.workoutStep.findFirst({
          where: { programId: program.id },
          orderBy: { order: 'desc' },
          select: { order: true },
        })
        order = (last?.order || 0) + 1
      }
      return tx.workoutStep.create({
        data: {
          ...parsed.data,
          order,
          programId: program.id,
        },
      })
    })

    if (!step) {
      return res.status(404).json({ error: 'Workout program not found' })
    }
    res.status(201).json(serializeWorkoutStep(step))
  } catch (err) {
    handleConflict(err, res, next)
  }
})

router.post(
  '/:id/steps/:stepId/illustration',
  uploadIllustration,
  async (req, res, next) => {
    const newUrl = req.file
      ? `/uploads/workouts/${req.params.id}/${req.file.filename}`
      : null
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }
      const existing = await prisma.workoutStep.findFirst({
        where: {
          id: req.params.stepId,
          programId: req.params.id,
        },
      })
      if (!existing) {
        await removeUploadedFile(newUrl)
        return res.status(404).json({ error: 'Workout step not found' })
      }

      const step = await prisma.workoutStep.update({
        where: { id: existing.id },
        data: { illustrationUrl: newUrl },
      })
      await removeUploadedFile(existing.illustrationUrl)
      res.status(201).json({
        url: newUrl,
        step: serializeWorkoutStep(step),
      })
    } catch (err) {
      await removeUploadedFile(newUrl)
      next(err)
    }
  }
)

router.get('/:id/steps/:stepId', async (req, res, next) => {
  try {
    const step = await prisma.workoutStep.findFirst({
      where: {
        id: req.params.stepId,
        programId: req.params.id,
      },
    })
    if (!step) {
      return res.status(404).json({ error: 'Workout step not found' })
    }
    res.json(serializeWorkoutStep(step))
  } catch (err) {
    next(err)
  }
})

router.put('/:id/steps/:stepId', async (req, res, next) => {
  try {
    const parsed = validateWorkoutStepPayload(req.body, { partial: true })
    if (parsed.error) return res.status(400).json({ error: parsed.error })

    const existing = await prisma.workoutStep.findFirst({
      where: {
        id: req.params.stepId,
        programId: req.params.id,
      },
      select: { id: true },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Workout step not found' })
    }
    const step = await prisma.workoutStep.update({
      where: { id: existing.id },
      data: parsed.data,
    })
    res.json(serializeWorkoutStep(step))
  } catch (err) {
    handleConflict(err, res, next)
  }
})

router.delete('/:id/steps/:stepId', async (req, res, next) => {
  try {
    const existing = await prisma.workoutStep.findFirst({
      where: {
        id: req.params.stepId,
        programId: req.params.id,
      },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Workout step not found' })
    }
    await prisma.workoutStep.delete({ where: { id: existing.id } })
    await removeUploadedFile(existing.illustrationUrl)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const program = await prisma.workoutProgram.findUnique({
      where: { id: req.params.id },
      include: workoutProgramDetailInclude,
    })
    if (!program) {
      return res.status(404).json({ error: 'Workout program not found' })
    }
    res.json(serializeAdminProgram(program, { includeSteps: true }))
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    if (
      Object.hasOwn(req.body || {}, 'id') &&
      String(req.body.id).trim().toLowerCase() !== req.params.id
    ) {
      return res.status(400).json({ error: 'Workout program id is immutable' })
    }
    const parsed = validateWorkoutProgramPayload(req.body, { partial: true })
    if (parsed.error) return res.status(400).json({ error: parsed.error })
    delete parsed.data.id

    const existing = await prisma.workoutProgram.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Workout program not found' })
    }
    const program = await prisma.workoutProgram.update({
      where: { id: existing.id },
      data: parsed.data,
      include: workoutProgramDetailInclude,
    })
    res.json(serializeAdminProgram(program, { includeSteps: true }))
  } catch (err) {
    handleConflict(err, res, next)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const program = await prisma.workoutProgram.findUnique({
      where: { id: req.params.id },
      include: {
        steps: {
          select: { illustrationUrl: true },
        },
      },
    })
    if (!program) {
      return res.status(404).json({ error: 'Workout program not found' })
    }
    await prisma.workoutProgram.delete({ where: { id: program.id } })
    await Promise.all(
      program.steps.map((step) => removeUploadedFile(step.illustrationUrl))
    )
    await fs.promises.rm(path.join(uploadsRoot, program.id), {
      recursive: true,
      force: true,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router

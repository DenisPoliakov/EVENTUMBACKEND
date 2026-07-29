import prisma from '../prisma.js'

export const WORKOUT_PHASES = ['warmup', 'work', 'rest', 'cooldown']

const phaseToPrisma = new Map(
  WORKOUT_PHASES.map((phase) => [phase, phase.toUpperCase()])
)

export const workoutProgramInclude = {
  steps: {
    select: {
      durationSeconds: true,
    },
  },
  _count: {
    select: {
      views: true,
    },
  },
}

export const workoutProgramDetailInclude = {
  steps: {
    orderBy: { order: 'asc' },
  },
  _count: {
    select: {
      views: true,
    },
  },
}

export const publicWorkoutProgramWhere = {
  locale: 'ru',
  isActive: true,
}

export const serializeWorkoutStep = (step) => ({
  id: step.id,
  programId: step.programId,
  order: step.order,
  phase: String(step.phase || '').toLowerCase(),
  title: step.title,
  description: step.description || null,
  durationSeconds: step.durationSeconds,
  illustrationUrl: step.illustrationUrl || null,
  poseIndex: step.poseIndex ?? null,
})

export const serializeWorkoutProgram = (
  program,
  { viewedByMe = false, includeAdminFields = false, includeSteps = false } = {}
) => {
  const steps = Array.isArray(program.steps) ? program.steps : []
  const serialized = {
    id: program.id,
    title: program.title,
    subtitle: program.subtitle || null,
    description: program.description,
    guide: program.guide || null,
    iconKey: program.iconKey || null,
    gradientStart: program.gradientStart || null,
    gradientEnd: program.gradientEnd || null,
    estimatedMinutes: program.estimatedMinutes ?? null,
    sortOrder: program.sortOrder,
    locale: program.locale,
    stepCount: steps.length,
    totalDurationSeconds: steps.reduce(
      (total, step) => total + step.durationSeconds,
      0
    ),
    uniqueViewerCount: program._count?.views ?? 0,
    viewedByMe: Boolean(viewedByMe),
  }

  if (includeSteps) {
    serialized.steps = steps.map(serializeWorkoutStep)
  }
  if (includeAdminFields) {
    serialized.isActive = Boolean(program.isActive)
    serialized.createdAt = program.createdAt
    serialized.updatedAt = program.updatedAt
  }
  return serialized
}

const parseInteger = (value, field, { min, max, nullable = false }) => {
  if (nullable && (value === null || value === '')) return { value: null }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { error: `${field} must be an integer between ${min} and ${max}` }
  }
  return { value: parsed }
}

const parseOptionalString = (body, field, data, maxLength) => {
  if (!Object.hasOwn(body, field)) return null
  const value = String(body[field] ?? '').trim()
  if (value.length > maxLength) {
    return { error: `${field} must be at most ${maxLength} characters` }
  }
  data[field] = value || null
  return null
}

export const validateWorkoutProgramPayload = (
  body,
  { partial = false } = {}
) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'payload must be a JSON object' }
  }

  const data = {}
  if (!partial || Object.hasOwn(body, 'id')) {
    const id = String(body.id ?? '').trim().toLowerCase()
    if (
      !id ||
      id.length > 120 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
    ) {
      return {
        error:
          'id must be a stable slug of at most 120 lowercase Latin letters, numbers, and single hyphens',
      }
    }
    data.id = id
  }

  for (const [field, maxLength] of [
    ['title', 200],
    ['description', 2000],
  ]) {
    if (!partial || Object.hasOwn(body, field)) {
      const value = String(body[field] ?? '').trim()
      if (!value) return { error: `${field} is required` }
      if (value.length > maxLength) {
        return { error: `${field} must be at most ${maxLength} characters` }
      }
      data[field] = value
    }
  }

  for (const [field, maxLength] of [
    ['subtitle', 300],
    ['guide', 20000],
    ['iconKey', 200],
  ]) {
    const result = parseOptionalString(body, field, data, maxLength)
    if (result) return result
  }

  for (const field of ['gradientStart', 'gradientEnd']) {
    if (!Object.hasOwn(body, field)) continue
    const value = String(body[field] ?? '').trim().toUpperCase()
    if (value && !/^#[0-9A-F]{6}$/.test(value)) {
      return { error: `${field} must be a 6-digit HEX color` }
    }
    data[field] = value || null
  }

  if (!partial || Object.hasOwn(body, 'estimatedMinutes')) {
    const result = parseInteger(
      body.estimatedMinutes ?? null,
      'estimatedMinutes',
      { min: 1, max: 1440, nullable: true }
    )
    if (result.error) return result
    data.estimatedMinutes = result.value
  }

  if (!partial || Object.hasOwn(body, 'sortOrder')) {
    const result = parseInteger(body.sortOrder ?? 0, 'sortOrder', {
      min: -10000,
      max: 10000,
    })
    if (result.error) return result
    data.sortOrder = result.value
  }

  if (Object.hasOwn(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') {
      return { error: 'isActive must be a boolean' }
    }
    data.isActive = body.isActive
  }

  if (Object.hasOwn(body, 'locale')) {
    const locale = String(body.locale ?? '').trim().toLowerCase()
    if (locale !== 'ru') return { error: 'locale must be ru' }
    data.locale = 'ru'
  } else if (!partial) {
    data.locale = 'ru'
  }

  return { data }
}

export const validateWorkoutStepPayload = (
  body,
  { partial = false, requireOrder = false } = {}
) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'payload must be a JSON object' }
  }

  const data = {}
  if (requireOrder || Object.hasOwn(body, 'order')) {
    const result = parseInteger(body.order, 'order', { min: 1, max: 10000 })
    if (result.error) return result
    data.order = result.value
  }

  if (!partial || Object.hasOwn(body, 'phase')) {
    const phase = String(body.phase ?? '').trim().toLowerCase()
    const normalized = phaseToPrisma.get(phase)
    if (!normalized) return { error: 'phase is invalid' }
    data.phase = normalized
  }

  if (!partial || Object.hasOwn(body, 'title')) {
    const title = String(body.title ?? '').trim()
    if (!title) return { error: 'title is required' }
    if (title.length > 200) {
      return { error: 'title must be at most 200 characters' }
    }
    data.title = title
  }

  const descriptionResult = parseOptionalString(
    body,
    'description',
    data,
    2000
  )
  if (descriptionResult) return descriptionResult

  if (!partial || Object.hasOwn(body, 'durationSeconds')) {
    const result = parseInteger(
      body.durationSeconds,
      'durationSeconds',
      { min: 1, max: 86400 }
    )
    if (result.error) return result
    data.durationSeconds = result.value
  }

  if (Object.hasOwn(body, 'illustrationUrl')) {
    const illustrationUrl = String(body.illustrationUrl ?? '').trim()
    if (illustrationUrl.length > 2000) {
      return { error: 'illustrationUrl must be at most 2000 characters' }
    }
    data.illustrationUrl = illustrationUrl || null
  }

  if (Object.hasOwn(body, 'poseIndex')) {
    const result = parseInteger(body.poseIndex, 'poseIndex', {
      min: 0,
      max: 5,
      nullable: true,
    })
    if (result.error) return result
    data.poseIndex = result.value
  }

  return { data }
}

export const recordWorkoutProgramView = async (programId, userId) => {
  let isFirstViewByUser = false
  try {
    await prisma.workoutProgramView.create({ data: { programId, userId } })
    isFirstViewByUser = true
  } catch (err) {
    if (err.code !== 'P2002') throw err
  }

  return {
    programId,
    uniqueViewerCount: await prisma.workoutProgramView.count({
      where: { programId },
    }),
    isFirstViewByUser,
  }
}

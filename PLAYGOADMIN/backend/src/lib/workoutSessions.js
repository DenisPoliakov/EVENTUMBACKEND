import prisma from '../prisma.js'

export const WORKOUT_SESSION_SOURCES = ['timer', 'manual', 'imported']

const sourceToPrisma = new Map(
  WORKOUT_SESSION_SOURCES.map((source) => [source, source.toUpperCase()])
)

const parseTimestamp = (value, field, { nullable = false } = {}) => {
  if (nullable && (value === null || value === undefined || value === '')) {
    return { value: null }
  }
  if (typeof value !== 'string' || !value.trim()) {
    return { error: `${field} must be an ISO 8601 timestamp` }
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return { error: `${field} must be an ISO 8601 timestamp` }
  }
  return { value: parsed }
}

export const validateWorkoutSessionPayload = (
  body,
  { defaultSource } = {}
) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'session must be a JSON object' }
  }

  const programId = String(body.programId ?? '').trim()
  if (!programId || programId.length > 120) {
    return { error: 'programId is required and must be at most 120 characters' }
  }

  const startedAtResult = parseTimestamp(body.startedAt, 'startedAt', {
    nullable: true,
  })
  if (startedAtResult.error) return startedAtResult

  const finishedAtResult = parseTimestamp(body.finishedAt, 'finishedAt')
  if (finishedAtResult.error) return finishedAtResult
  if (
    startedAtResult.value &&
    startedAtResult.value > finishedAtResult.value
  ) {
    return { error: 'startedAt must not be after finishedAt' }
  }

  const durationSeconds = Number(body.durationSeconds)
  if (
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 1 ||
    durationSeconds > 86400
  ) {
    return {
      error: 'durationSeconds must be an integer between 1 and 86400',
    }
  }

  const source = String(body.source ?? defaultSource ?? '')
    .trim()
    .toLowerCase()
  const normalizedSource = sourceToPrisma.get(source)
  if (!normalizedSource) {
    return {
      error: `source must be one of: ${WORKOUT_SESSION_SOURCES.join(', ')}`,
    }
  }

  let customPlan = null
  if (body.customPlan !== undefined && body.customPlan !== null) {
    if (
      typeof body.customPlan !== 'object' ||
      Array.isArray(body.customPlan)
    ) {
      return { error: 'customPlan must be a JSON object or null' }
    }
    let encoded
    try {
      encoded = JSON.stringify(body.customPlan)
    } catch {
      return { error: 'customPlan must be valid JSON' }
    }
    if (Buffer.byteLength(encoded, 'utf8') > 50 * 1024) {
      return { error: 'customPlan must not exceed 50 KB' }
    }
    customPlan = body.customPlan
  }

  let clientKey = null
  if (body.clientKey !== undefined && body.clientKey !== null) {
    if (typeof body.clientKey !== 'string') {
      return { error: 'clientKey must be a string or null' }
    }
    clientKey = body.clientKey.trim()
    if (!clientKey || clientKey.length > 200) {
      return {
        error: 'clientKey must be between 1 and 200 characters when provided',
      }
    }
  }

  return {
    data: {
      programId,
      startedAt: startedAtResult.value,
      finishedAt: finishedAtResult.value,
      durationSeconds,
      source: normalizedSource,
      customPlan,
      clientKey,
    },
  }
}

export const serializeWorkoutSession = (session) => ({
  id: session.id,
  programId: session.programId,
  startedAt: session.startedAt || null,
  finishedAt: session.finishedAt,
  durationSeconds: session.durationSeconds,
  source: String(session.source || '').toLowerCase(),
  customPlan: session.customPlan ?? null,
  clientKey: session.clientKey || null,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
})

const sessionIdentityWhere = (userId, data) => ({
  OR: [
    ...(data.clientKey ? [{ userId, clientKey: data.clientKey }] : []),
    {
      userId,
      programId: data.programId,
      finishedAt: data.finishedAt,
    },
  ],
})

export const createWorkoutSessionServerWins = async (userId, data) => {
  const where = sessionIdentityWhere(userId, data)
  const existing = await prisma.workoutSession.findFirst({ where })
  if (existing) return { session: existing, created: false }

  try {
    const session = await prisma.workoutSession.create({
      data: { ...data, userId },
    })
    return { session, created: true }
  } catch (err) {
    if (err.code !== 'P2002') throw err
    const winner = await prisma.workoutSession.findFirst({ where })
    if (!winner) throw err
    return { session: winner, created: false }
  }
}

import express from 'express'

import prisma from '../prisma.js'

const router = express.Router()
const MAX_RANGE_DAYS = 366

const parseDateRange = (query) => {
  const to = query.to ? new Date(String(query.to)) : new Date()
  const from = query.from
    ? new Date(String(query.from))
    : new Date(to.getTime() - 30 * 86_400_000)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { error: 'from and to must be ISO 8601 timestamps' }
  }
  if (from > to) return { error: 'from must not be after to' }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    return { error: `date range must not exceed ${MAX_RANGE_DAYS} days` }
  }
  return { from, to }
}

router.get('/', async (req, res, next) => {
  try {
    const range = parseDateRange(req.query)
    if (range.error) return res.status(400).json({ error: range.error })
    const rawLimit = Number(req.query.popularLimit ?? 10)
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) {
      return res.status(400).json({
        error: 'popularLimit must be an integer between 1 and 50',
      })
    }
    const where = { finishedAt: { gte: range.from, lte: range.to } }
    const [aggregate, users, popular] = await Promise.all([
      prisma.workoutSession.aggregate({
        where,
        _count: { _all: true },
        _sum: { durationSeconds: true },
        _avg: { durationSeconds: true },
      }),
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT "userId")::int AS "count"
        FROM "WorkoutSession"
        WHERE "finishedAt" >= ${range.from} AND "finishedAt" <= ${range.to}
      `,
      prisma.workoutSession.groupBy({
        by: ['programId'],
        where,
        _count: { _all: true },
        _sum: { durationSeconds: true },
        orderBy: { _count: { programId: 'desc' } },
        take: rawLimit,
      }),
    ])
    const programs = popular.length
      ? await prisma.workoutProgram.findMany({
          where: { id: { in: popular.map((item) => item.programId) } },
          select: { id: true, title: true, locale: true, isActive: true },
        })
      : []
    const programMap = new Map(programs.map((item) => [item.id, item]))

    res.json({
      range: { from: range.from, to: range.to, maxDays: MAX_RANGE_DAYS },
      metrics: {
        sessions: aggregate._count._all,
        users: users[0]?.count ?? 0,
        durationSeconds: aggregate._sum.durationSeconds ?? 0,
        averageDurationSeconds: Math.round(aggregate._avg.durationSeconds ?? 0),
      },
      popularPrograms: popular.map((item) => ({
        programId: item.programId,
        title: programMap.get(item.programId)?.title ?? item.programId,
        locale: programMap.get(item.programId)?.locale ?? null,
        isActive: programMap.get(item.programId)?.isActive ?? false,
        sessions: item._count._all,
        durationSeconds: item._sum.durationSeconds ?? 0,
      })),
    })
  } catch (error) {
    next(error)
  }
})

export default router

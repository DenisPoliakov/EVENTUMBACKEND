import express from 'express'

import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()
const MAX_JSON_BYTES = 100 * 1024
const MAX_HISTORY = 100

const validateJsonField = (body, field) => {
  if (!Object.hasOwn(body ?? {}, field) || body[field] === undefined) {
    return { error: `${field} is required` }
  }
  let size
  try {
    size = Buffer.byteLength(JSON.stringify(body[field]))
  } catch {
    return { error: `${field} must be JSON-serializable` }
  }
  if (size > MAX_JSON_BYTES) {
    return { error: `${field} must not exceed ${MAX_JSON_BYTES} bytes` }
  }
  return { value: body[field] }
}

router.get('/me/ai-matches', requireAuth, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 20)
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY) {
      return res.status(400).json({
        error: `limit must be an integer between 1 and ${MAX_HISTORY}`,
      })
    }
    const items = await prisma.aiMatchHistory.findMany({
      where: { userId: req.auth.sub },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    res.json({
      items,
      storesCallerSuppliedHistoryOnly: true,
      generatesRecommendations: false,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/me/ai-matches', requireAuth, async (req, res, next) => {
  try {
    const requestJson = validateJsonField(req.body, 'requestJson')
    if (requestJson.error) return res.status(400).json({ error: requestJson.error })
    const resultJson = validateJsonField(req.body, 'resultJson')
    if (resultJson.error) return res.status(400).json({ error: resultJson.error })

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.aiMatchHistory.create({
        data: {
          userId: req.auth.sub,
          requestJson: requestJson.value,
          resultJson: resultJson.value,
        },
      })
      const overflow = await tx.aiMatchHistory.findMany({
        where: { userId: req.auth.sub },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: MAX_HISTORY,
        select: { id: true },
      })
      if (overflow.length) {
        await tx.aiMatchHistory.deleteMany({
          where: { id: { in: overflow.map(({ id }) => id) } },
        })
      }
      return created
    })
    res.status(201).json({
      item,
      storesCallerSuppliedHistoryOnly: true,
      generatesRecommendations: false,
    })
  } catch (error) {
    next(error)
  }
})

router.delete('/me/ai-matches/:id', requireAuth, async (req, res, next) => {
  try {
    const removed = await prisma.aiMatchHistory.deleteMany({
      where: { id: req.params.id, userId: req.auth.sub },
    })
    if (!removed.count) return res.status(404).json({ error: 'AI match history item not found' })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router

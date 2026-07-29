import express from 'express'

import { requireAuth } from '../middleware/requireAuth.js'
import prisma from '../prisma.js'

const router = express.Router()
const PLATFORMS = new Set(['IOS', 'ANDROID', 'WEB'])

const optionalString = (value, maxLength) => {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).trim()
  if (!normalized || normalized.length > maxLength) return undefined
  return normalized
}

const serializePushToken = (item) => ({
  id: item.id,
  platform: item.platform,
  deviceId: item.deviceId || '',
  deviceName: item.deviceName || '',
  appVersion: item.appVersion || '',
  locale: item.locale || '',
  lastSeenAt: item.lastSeenAt,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
})

router.post('/me/push-tokens', requireAuth, async (req, res, next) => {
  try {
    const token = String(req.body.token || '').trim()
    const platform = String(req.body.platform || '').trim().toUpperCase()
    if (
      token.length < 20 ||
      token.length > 4096 ||
      /\s/.test(token)
    ) {
      return res.status(400).json({ error: 'token is invalid' })
    }
    if (!PLATFORMS.has(platform)) {
      return res.status(400).json({ error: 'platform must be IOS, ANDROID, or WEB' })
    }

    const metadata = {
      deviceId: optionalString(req.body.deviceId, 255),
      deviceName: optionalString(req.body.deviceName, 255),
      appVersion: optionalString(req.body.appVersion, 100),
      locale: optionalString(req.body.locale, 35),
    }
    if (Object.values(metadata).includes(undefined)) {
      return res.status(400).json({ error: 'device metadata is invalid' })
    }

    const pushToken = await prisma.$transaction(async (tx) => {
      if (metadata.deviceId) {
        await tx.pushToken.deleteMany({
          where: {
            userId: req.auth.sub,
            platform,
            deviceId: metadata.deviceId,
            token: { not: token },
          },
        })
      }
      return tx.pushToken.upsert({
        where: { token },
        update: {
          userId: req.auth.sub,
          platform,
          ...metadata,
          lastSeenAt: new Date(),
        },
        create: {
          userId: req.auth.sub,
          token,
          platform,
          ...metadata,
        },
      })
    })

    res.json({ pushToken: serializePushToken(pushToken) })
  } catch (error) {
    next(error)
  }
})

router.delete('/me/push-tokens/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await prisma.pushToken.deleteMany({
      where: { id: req.params.id, userId: req.auth.sub },
    })
    if (!result.count) return res.status(404).json({ error: 'Push token not found' })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

router.delete('/me/push-tokens', requireAuth, async (req, res, next) => {
  try {
    const token = String(req.body.token || '').trim()
    if (!token) return res.status(400).json({ error: 'token is required' })
    await prisma.pushToken.deleteMany({
      where: { token, userId: req.auth.sub },
    })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router

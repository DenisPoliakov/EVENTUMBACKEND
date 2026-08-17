import express from 'express'

import prisma from '../prisma.js'
import {
  acceptFriendship,
  cancelFriendshipById,
  friendshipInclude,
  listLimit,
  rejectFriendship,
  removeFriendship,
  requestFriendship,
  resolveFriendTargetUserId,
  searchUsersByUsername,
  serializeFriendship,
} from '../lib/friends.js'
import { resolveProductCode } from '../lib/product.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

const handleFriendshipError = (err, res, next) => {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
  return next(err)
}

/// Поиск пользователей по username (и имени) — чтобы находить людей для дружбы и чатов.
router.get('/users/search', requireAuth, async (req, res, next) => {
  try {
    const productCode = resolveProductCode(req)
    const query = String(req.query.username || req.query.q || '').trim()
    const limit = listLimit(req.query.limit, 20, 50)
    const users = await searchUsersByUsername({
      query,
      currentUserId: req.auth.sub,
      limit,
      productCode,
    })
    res.json({ users, q: query, productCode })
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

router.get('/me/friends', requireAuth, async (req, res, next) => {
  try {
    const productCode = resolveProductCode(req)
    const limit = listLimit(req.query.limit, 50, 100)
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: req.auth.sub }, { addresseeId: req.auth.sub }],
      },
      include: friendshipInclude,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    const friends = await Promise.all(
      friendships.map((row) => serializeFriendship(row, req.auth.sub, productCode)),
    )
    res.json({ friends, productCode })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.get('/me/friends/requests', requireAuth, async (req, res, next) => {
  try {
    const productCode = resolveProductCode(req)
    const limit = listLimit(req.query.limit, 50, 100)
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'PENDING',
        addresseeId: req.auth.sub,
      },
      include: friendshipInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const requests = await Promise.all(
      friendships.map((row) => serializeFriendship(row, req.auth.sub, productCode)),
    )
    res.json({ requests, productCode })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.get('/me/friends/outgoing', requireAuth, async (req, res, next) => {
  try {
    const productCode = resolveProductCode(req)
    const limit = listLimit(req.query.limit, 50, 100)
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'PENDING',
        requesterId: req.auth.sub,
      },
      include: friendshipInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const requests = await Promise.all(
      friendships.map((row) => serializeFriendship(row, req.auth.sub, productCode)),
    )
    res.json({ requests, productCode })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.post('/me/friends', requireAuth, async (req, res, next) => {
  try {
    const productCode = resolveProductCode(req)
    const targetUserId = await resolveFriendTargetUserId(req.body || {})
    if (!targetUserId) {
      return res.status(400).json({
        error: 'userId is required',
        message:
          'Передайте userId (или username) пользователя, которому отправляете заявку.',
      })
    }
    const friendship = await requestFriendship(req.auth.sub, targetUserId, productCode)
    res.status(201).json({
      friendship: await serializeFriendship(friendship, req.auth.sub, productCode),
    })
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

router.post('/me/friends/:friendshipId/accept', requireAuth, async (req, res, next) => {
  try {
    const productCode = resolveProductCode(req)
    const friendship = await acceptFriendship(
      req.params.friendshipId,
      req.auth.sub,
      productCode,
    )
    res.json({
      friendship: await serializeFriendship(friendship, req.auth.sub, productCode),
    })
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

router.post('/me/friends/:friendshipId/reject', requireAuth, async (req, res, next) => {
  try {
    const productCode = resolveProductCode(req)
    const friendship = await rejectFriendship(req.params.friendshipId, req.auth.sub)
    res.json({
      friendship: await serializeFriendship(friendship, req.auth.sub, productCode),
    })
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

/// Отозвать исходящую заявку или удалить связь по friendshipId
router.delete('/me/friends/requests/:friendshipId', requireAuth, async (req, res, next) => {
  try {
    await cancelFriendshipById(req.params.friendshipId, req.auth.sub)
    res.status(204).send()
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

/// Удалить из друзей / отменить заявку по userId второго человека
router.delete('/me/friends/:userId', requireAuth, async (req, res, next) => {
  try {
    await removeFriendship(req.auth.sub, req.params.userId)
    res.status(204).send()
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

export default router

import express from 'express'

import prisma from '../prisma.js'
import {
  acceptFriendship,
  friendshipInclude,
  listLimit,
  rejectFriendship,
  removeFriendship,
  requestFriendship,
  searchUsersByUsername,
  serializeFriendship,
} from '../lib/friends.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

const handleFriendshipError = (err, res, next) => {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
  return next(err)
}

/// Поиск пользователей по username (и имени) — чтобы находить людей для дружбы и чатов.
router.get('/users/search', requireAuth, async (req, res, next) => {
  try {
    const query = String(req.query.username || req.query.q || '').trim()
    const limit = listLimit(req.query.limit, 20, 50)
    const users = await searchUsersByUsername({
      query,
      currentUserId: req.auth.sub,
      limit,
    })
    res.json({ users, q: query })
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

router.get('/me/friends', requireAuth, async (req, res, next) => {
  try {
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
      friendships.map((row) => serializeFriendship(row, req.auth.sub)),
    )
    res.json({ friends })
  } catch (err) {
    next(err)
  }
})

router.get('/me/friends/requests', requireAuth, async (req, res, next) => {
  try {
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
      friendships.map((row) => serializeFriendship(row, req.auth.sub)),
    )
    res.json({ requests })
  } catch (err) {
    next(err)
  }
})

router.get('/me/friends/outgoing', requireAuth, async (req, res, next) => {
  try {
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
      friendships.map((row) => serializeFriendship(row, req.auth.sub)),
    )
    res.json({ requests })
  } catch (err) {
    next(err)
  }
})

router.post('/me/friends', requireAuth, async (req, res, next) => {
  try {
    const friendship = await requestFriendship(req.auth.sub, req.body.userId)
    res.status(201).json({
      friendship: await serializeFriendship(friendship, req.auth.sub),
    })
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

router.post('/me/friends/:friendshipId/accept', requireAuth, async (req, res, next) => {
  try {
    const friendship = await acceptFriendship(req.params.friendshipId, req.auth.sub)
    res.json({
      friendship: await serializeFriendship(friendship, req.auth.sub),
    })
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

router.post('/me/friends/:friendshipId/reject', requireAuth, async (req, res, next) => {
  try {
    const friendship = await rejectFriendship(req.params.friendshipId, req.auth.sub)
    res.json({
      friendship: await serializeFriendship(friendship, req.auth.sub),
    })
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

router.delete('/me/friends/:userId', requireAuth, async (req, res, next) => {
  try {
    await removeFriendship(req.auth.sub, req.params.userId)
    res.status(204).send()
  } catch (err) {
    handleFriendshipError(err, res, next)
  }
})

export default router

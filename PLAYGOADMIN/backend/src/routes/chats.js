import express from 'express'
import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  buildChatLastReadPatch,
  createChatTextMessage,
  createOrGetDirectChat,
  getDirectChatByIdForUser,
  getDirectChatInclude,
  messageInclude,
  serializeChatMessage,
  serializeDirectChat,
} from '../lib/chats.js'
import { broadcastChatMessage, broadcastChatRead } from '../lib/chatRealtime.js'

const router = express.Router()

const listLimit = (value, fallback = 50, max = 100) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 1), max)
}

const ensureTargetUser = async (targetUserId, currentUserId) => {
  const normalized = String(targetUserId || '').trim()
  if (!normalized) {
    const error = new Error('userId is required')
    error.statusCode = 400
    throw error
  }
  if (normalized === currentUserId) {
    const error = new Error('Cannot create chat with yourself')
    error.statusCode = 400
    throw error
  }

  const target = await prisma.user.findUnique({ where: { id: normalized } })
  if (!target) {
    const error = new Error('User not found')
    error.statusCode = 404
    throw error
  }

  return target
}

router.get('/me/chats', requireAuth, async (req, res, next) => {
  try {
    const limit = listLimit(req.query.limit, 50, 100)
    const chats = await prisma.directChat.findMany({
      where: {
        OR: [{ userAId: req.auth.sub }, { userBId: req.auth.sub }],
      },
      include: getDirectChatInclude(),
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    const serialized = await Promise.all(
      chats.map((chat) => serializeDirectChat(chat, req.auth.sub)),
    )

    res.json({ chats: serialized })
  } catch (err) {
    next(err)
  }
})

router.post('/me/chats/direct', requireAuth, async (req, res, next) => {
  try {
    const target = await ensureTargetUser(req.body.userId, req.auth.sub)
    const chat = await createOrGetDirectChat(req.auth.sub, target.id)
    res.status(201).json({
      chat: await serializeDirectChat(chat, req.auth.sub),
    })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.post('/me/chats/coach-profile/:coachProfileId', requireAuth, async (req, res, next) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { id: req.params.coachProfileId },
      select: { userId: true },
    })
    if (!coachProfile) return res.status(404).json({ error: 'Coach profile not found' })

    await ensureTargetUser(coachProfile.userId, req.auth.sub)
    const chat = await createOrGetDirectChat(req.auth.sub, coachProfile.userId)

    res.status(201).json({
      chat: await serializeDirectChat(chat, req.auth.sub),
    })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.get('/me/chats/:chatId', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    res.json({
      chat: await serializeDirectChat(chat, req.auth.sub),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/me/chats/:chatId/messages', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    const limit = listLimit(req.query.limit, 50, 100)
    const before = req.query.before ? new Date(String(req.query.before)) : null
    if (before && Number.isNaN(before.getTime())) {
      return res.status(400).json({ error: 'before must be a valid ISO date' })
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        chatId: chat.id,
        createdAt: before ? { lt: before } : undefined,
      },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    res.json({
      messages: messages.reverse().map(serializeChatMessage),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/me/chats/:chatId/messages', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    const text = String(req.body.text || '').trim()
    if (!text) return res.status(400).json({ error: 'text is required' })

    const message = await createChatTextMessage(chat, req.auth.sub, text)
    await broadcastChatMessage({ chatId: chat.id, message })

    res.status(201).json({
      message: serializeChatMessage(message),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/me/chats/:chatId/read', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    const now = new Date()
    const updated = await prisma.directChat.update({
      where: { id: chat.id },
      data: buildChatLastReadPatch(chat, req.auth.sub, now),
      include: getDirectChatInclude(),
    })
    await broadcastChatRead({ chatId: chat.id, userId: req.auth.sub, readAt: now.toISOString() })

    res.json({
      chat: await serializeDirectChat(updated, req.auth.sub),
    })
  } catch (err) {
    next(err)
  }
})

export default router

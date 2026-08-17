import express from 'express'
import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { resolveProductCode } from '../lib/product.js'
import {
  buildChatLastReadPatch,
  createChatTextMessage,
  createOrGetDirectChat,
  editChatTextMessage,
  getDirectChatByIdForUser,
  getDirectChatInclude,
  isChatHiddenForUser,
  messageInclude,
  participantWhereForUser,
  serializeChatMessage,
  serializeDirectChat,
  softDeleteChatMessage,
  softDeleteDirectChatForUser,
} from '../lib/chats.js'
import {
  broadcastChatDeleted,
  broadcastChatMessage,
  broadcastChatMessageDeleted,
  broadcastChatMessageUpdated,
  broadcastChatRead,
} from '../lib/chatRealtime.js'

const router = express.Router()

const listLimit = (value, fallback = 50, max = 100) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 1), max)
}

const ensureTargetUser = async (targetUserId, currentUserId, { allowSelf = false } = {}) => {
  const normalized = String(targetUserId || '').trim()
  if (!normalized) {
    const error = new Error('userId is required')
    error.statusCode = 400
    throw error
  }
  if (!allowSelf && normalized === currentUserId) {
    const error = new Error('Cannot create chat with yourself — use POST /api/me/chats/saved')
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
    const productCode = resolveProductCode(req)
    const limit = listLimit(req.query.limit, 50, 100)
    const chats = await prisma.directChat.findMany({
      where: participantWhereForUser(req.auth.sub, productCode),
      include: getDirectChatInclude(),
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    const serialized = await Promise.all(
      chats.map((chat) => serializeDirectChat(chat, req.auth.sub)),
    )

    res.json({ productCode, chats: serialized })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.post('/me/chats/saved', requireAuth, async (req, res, next) => {
  try {
    const productCode = resolveProductCode(req)
    const chat = await createOrGetDirectChat(req.auth.sub, req.auth.sub, productCode, {
      isSelfChat: true,
    })
    res.status(201).json({
      chat: await serializeDirectChat(chat, req.auth.sub),
    })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.post('/me/chats/direct', requireAuth, async (req, res, next) => {
  try {
    const productCode = resolveProductCode(req)
    const target = await ensureTargetUser(req.body.userId, req.auth.sub)
    const chat = await createOrGetDirectChat(req.auth.sub, target.id, productCode)
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
      include: {
        club: { include: { sport: true } },
      },
    })
    if (!coachProfile) return res.status(404).json({ error: 'Coach profile not found' })

    await ensureTargetUser(coachProfile.userId, req.auth.sub)
    const chat = await createOrGetDirectChat(req.auth.sub, coachProfile.userId, 'CLUBS')

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
    if (!chat || isChatHiddenForUser(chat, req.auth.sub)) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    res.json({
      chat: await serializeDirectChat(chat, req.auth.sub),
    })
  } catch (err) {
    next(err)
  }
})

router.delete('/me/chats/:chatId', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat || isChatHiddenForUser(chat, req.auth.sub)) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    await softDeleteDirectChatForUser(chat, req.auth.sub)
    await broadcastChatDeleted({ chatId: chat.id, userId: req.auth.sub })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.get('/me/chats/:chatId/messages', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat || isChatHiddenForUser(chat, req.auth.sub)) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    const limit = listLimit(req.query.limit, 50, 100)
    const before = req.query.before ? new Date(String(req.query.before)) : null
    if (before && Number.isNaN(before.getTime())) {
      return res.status(400).json({ error: 'before must be a valid ISO date' })
    }
    const includeDeleted =
      String(req.query.includeDeleted || '').toLowerCase() === 'true'

    const messages = await prisma.chatMessage.findMany({
      where: {
        chatId: chat.id,
        deletedAt: includeDeleted ? undefined : null,
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

router.patch('/me/chats/:chatId/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat || isChatHiddenForUser(chat, req.auth.sub)) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    const text = String(req.body.text || '').trim()
    if (!text) return res.status(400).json({ error: 'text is required' })

    const message = await editChatTextMessage(chat, req.params.messageId, req.auth.sub, text)
    await broadcastChatMessageUpdated({ chatId: chat.id, message })

    res.json({ message: serializeChatMessage(message) })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.delete('/me/chats/:chatId/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat || isChatHiddenForUser(chat, req.auth.sub)) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    const message = await softDeleteChatMessage(chat, req.params.messageId, req.auth.sub)
    await broadcastChatMessageDeleted({ chatId: chat.id, message })

    res.json({ message: serializeChatMessage(message) })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

router.post('/me/chats/:chatId/read', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat || isChatHiddenForUser(chat, req.auth.sub)) {
      return res.status(404).json({ error: 'Chat not found' })
    }

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

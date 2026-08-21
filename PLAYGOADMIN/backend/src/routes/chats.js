import express from 'express'
import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { resolveProductCode } from '../lib/product.js'
import {
  assertAlbumItemCount,
  assertMimeMatchesType,
  assertVideoNoteRules,
  createChatMediaUploader,
  isAllowedChatMediaUrl,
  normalizeMediaUrlList,
  normalizeMessageType,
  parseDurationMs,
  parseOptionalInt,
  publicUrlForChatFile,
  resolveAlbumTypeFromMimes,
  CHAT_ALBUM_MAX_ITEMS,
} from '../lib/chatMedia.js'
import {
  buildChatLastReadPatch,
  createChatMessage,
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

const resolveReplyToMessageId = (body) => {
  const raw =
    body?.replyToMessageId ||
    body?.replyToId ||
    body?.replyMessageId ||
    body?.reply_to ||
    ''
  const value = String(raw || '').trim()
  return value || null
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

/**
 * JSON send:
 * - TEXT: { text, replyToMessageId? }
 * - media already on server (cache sync): { type, mediaUrls, caption?/text?, durationMs?, replyToMessageId?, ... }
 */
router.post('/me/chats/:chatId/messages', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    const typeRaw = normalizeMessageType(req.body.type || 'TEXT')
    const text = String(req.body.text ?? req.body.caption ?? '').trim()
    const replyToMessageId = resolveReplyToMessageId(req.body)
    const durationMs = parseDurationMs(req.body.durationMs)
    const width = parseOptionalInt(req.body.width, 'width')
    const height = parseOptionalInt(req.body.height, 'height')
    const thumbnailUrl = String(req.body.thumbnailUrl || '').trim() || null
    const clientPlatform = req.body.clientPlatform || req.headers['x-client-platform']

    let mediaUrls = normalizeMediaUrlList(req.body.mediaUrls ?? req.body.mediaUrl)
    const mediaMimeTypes = normalizeMediaUrlList(req.body.mediaMimeTypes)
    const mediaBytes = Array.isArray(req.body.mediaBytes)
      ? req.body.mediaBytes.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : []

    const type =
      typeRaw === 'TEXT' || typeRaw === 'VOICE' || typeRaw === 'VIDEO_NOTE'
        ? typeRaw
        : resolveAlbumTypeFromMimes(mediaMimeTypes, typeRaw)

    if (type === 'VIDEO_NOTE') {
      assertVideoNoteRules({ durationMs, clientPlatform })
    }

    if (type !== 'TEXT') {
      if (mediaUrls.length === 0) {
        return res.status(400).json({
          error: 'mediaUrls required (or use POST /api/me/chats/:chatId/media with files)',
        })
      }
      if (type === 'VOICE' || type === 'VIDEO_NOTE') {
        if (mediaUrls.length !== 1) {
          return res.status(400).json({ error: `${type} requires exactly one media file` })
        }
      } else {
        assertAlbumItemCount(mediaUrls.length, type)
      }
      for (const url of mediaUrls) {
        if (!isAllowedChatMediaUrl(url, chat.id, chat.productCode)) {
          return res.status(400).json({
            error: `mediaUrl must belong to this chat uploads: ${url}`,
          })
        }
      }
      for (const mime of mediaMimeTypes) {
        assertMimeMatchesType(type, mime)
      }
    }

    const message = await createChatMessage(chat, req.auth.sub, {
      type,
      text,
      replyToMessageId,
      mediaUrls: type === 'TEXT' ? [] : mediaUrls,
      mediaMimeTypes: type === 'TEXT' ? [] : mediaMimeTypes,
      mediaBytes: type === 'TEXT' ? [] : mediaBytes,
      durationMs,
      thumbnailUrl,
      width,
      height,
      isRound: type === 'VIDEO_NOTE',
    })
    await broadcastChatMessage({ chatId: chat.id, message })

    res.status(201).json({
      message: serializeChatMessage(message),
    })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})

/**
 * Upload-only (для синка кеша с устройства без сразу создания сообщения).
 * Потом клиент шлёт POST /messages с mediaUrls.
 */
router.post('/me/chats/:chatId/media/upload', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    const upload = createChatMediaUploader(chat.productCode, chat.id)
    upload.fields([
      { name: 'files', maxCount: CHAT_ALBUM_MAX_ITEMS },
      { name: 'file', maxCount: CHAT_ALBUM_MAX_ITEMS },
    ])(req, res, async (uploadErr) => {
      try {
        if (uploadErr) {
          return res.status(400).json({ error: uploadErr.message || 'Upload failed' })
        }
        const files = [
          ...(req.files?.files || []),
          ...(req.files?.file || []),
        ]
        if (files.length === 0) {
          return res.status(400).json({ error: 'No files uploaded (fields: files or file)' })
        }
        if (files.length > CHAT_ALBUM_MAX_ITEMS) {
          return res.status(400).json({
            error: `At most ${CHAT_ALBUM_MAX_ITEMS} files per request`,
          })
        }

        const typeHint = req.body.type
          ? normalizeMessageType(req.body.type)
          : null
        if (typeHint && typeHint !== 'TEXT') {
          const effective =
            typeHint === 'VOICE' || typeHint === 'VIDEO_NOTE'
              ? typeHint
              : resolveAlbumTypeFromMimes(
                  files.map((f) => f.mimetype),
                  typeHint,
                )
          for (const file of files) {
            assertMimeMatchesType(effective, file.mimetype)
          }
        }

        const uploaded = files.map((file) => ({
          url: publicUrlForChatFile(chat.productCode, chat.id, file.filename),
          mimeType: file.mimetype,
          bytes: file.size,
          originalName: file.originalname,
        }))

        return res.status(201).json({
          productCode: chat.productCode,
          chatId: chat.id,
          files: uploaded,
          mediaUrls: uploaded.map((item) => item.url),
        })
      } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
        return next(err)
      }
    })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})
/**
 * Multipart media send (preferred for new uploads).
 * fields: type, caption|text?, replyToMessageId?, durationMs?, width?, height?, clientPlatform?
 * files: file / files — до 10 объектов; IMAGE | VIDEO | ALBUM (микс фото+видео)
 */
router.post('/me/chats/:chatId/media', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    const upload = createChatMediaUploader(chat.productCode, chat.id)
    upload.fields([
      { name: 'files', maxCount: CHAT_ALBUM_MAX_ITEMS },
      { name: 'file', maxCount: CHAT_ALBUM_MAX_ITEMS },
    ])(req, res, async (uploadErr) => {
      try {
        if (uploadErr) {
          return res.status(400).json({ error: uploadErr.message || 'Upload failed' })
        }

        const files = [
          ...(req.files?.files || []),
          ...(req.files?.file || []),
        ]
        const typeRaw = normalizeMessageType(req.body.type)
        if (typeRaw === 'TEXT') {
          return res.status(400).json({ error: 'Use POST /messages for TEXT' })
        }
        if (files.length === 0) {
          return res.status(400).json({ error: 'No files uploaded (fields: files or file)' })
        }

        const mediaMimeTypes = files.map((file) => file.mimetype)
        const type =
          typeRaw === 'VOICE' || typeRaw === 'VIDEO_NOTE'
            ? typeRaw
            : resolveAlbumTypeFromMimes(mediaMimeTypes, typeRaw)

        for (const file of files) {
          assertMimeMatchesType(type, file.mimetype)
        }

        const durationMs = parseDurationMs(req.body.durationMs)
        const width = parseOptionalInt(req.body.width, 'width')
        const height = parseOptionalInt(req.body.height, 'height')
        const clientPlatform = req.body.clientPlatform || req.headers['x-client-platform']
        if (type === 'VIDEO_NOTE') {
          assertVideoNoteRules({ durationMs, clientPlatform })
          if (files.length !== 1) {
            return res.status(400).json({ error: 'VIDEO_NOTE requires exactly one file' })
          }
        }
        if (type === 'VOICE') {
          if (files.length !== 1) {
            return res.status(400).json({ error: 'VOICE requires exactly one file' })
          }
        }
        if (['IMAGE', 'VIDEO', 'ALBUM'].includes(type)) {
          assertAlbumItemCount(files.length, type)
        }

        const mediaUrls = files.map((file) =>
          publicUrlForChatFile(chat.productCode, chat.id, file.filename),
        )
        const mediaBytes = files.map((file) => file.size)
        const text = String(req.body.text ?? req.body.caption ?? '').trim()
        const replyToMessageId = resolveReplyToMessageId(req.body)
        const thumbnailUrl = String(req.body.thumbnailUrl || '').trim() || null

        const message = await createChatMessage(chat, req.auth.sub, {
          type,
          text,
          replyToMessageId,
          mediaUrls,
          mediaMimeTypes,
          mediaBytes,
          durationMs,
          thumbnailUrl,
          width,
          height,
          isRound: type === 'VIDEO_NOTE',
        })
        await broadcastChatMessage({ chatId: chat.id, message })

        return res.status(201).json({
          message: serializeChatMessage(message),
        })
      } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
        return next(err)
      }
    })
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
    next(err)
  }
})


router.patch('/me/chats/:chatId/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const chat = await getDirectChatByIdForUser(req.params.chatId, req.auth.sub)
    if (!chat || isChatHiddenForUser(chat, req.auth.sub)) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    const text = String(req.body.text ?? req.body.caption ?? '').trim()
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

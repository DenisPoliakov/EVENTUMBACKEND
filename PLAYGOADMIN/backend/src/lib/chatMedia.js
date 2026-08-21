import fs from 'fs'
import path from 'path'

import multer from 'multer'

/** Максимум объектов (фото/видео) в одном сообщении-альбоме */
export const CHAT_ALBUM_MAX_ITEMS = 10

export const CHAT_MEDIA_TYPES = new Set([
  'IMAGE',
  'VOICE',
  'VIDEO',
  'VIDEO_NOTE',
  'ALBUM',
])
export const VIDEO_NOTE_MAX_DURATION_MS = 60_000

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

const AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
  'audio/wav',
  'audio/x-m4a',
  'audio/m4a',
])

const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/3gpp',
])

const extForMime = (mime) => {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/aac': '.aac',
    'audio/ogg': '.ogg',
    'audio/opus': '.opus',
    'audio/webm': '.webm',
    'audio/wav': '.wav',
    'audio/x-m4a': '.m4a',
    'audio/m4a': '.m4a',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/x-m4v': '.m4v',
    'video/3gpp': '.3gp',
  }
  return map[mime] || ''
}

export const isImageMime = (mime) => {
  const m = String(mime || '').toLowerCase()
  return IMAGE_MIME.has(m) || m.startsWith('image/')
}

export const isVideoMime = (mime) => {
  const m = String(mime || '').toLowerCase()
  return VIDEO_MIME.has(m) || m.startsWith('video/')
}

export const chatMediaRoot = path.join(process.cwd(), 'public', 'uploads', 'chats')
fs.mkdirSync(chatMediaRoot, { recursive: true })

export const ensureChatMediaDir = (productCode, chatId) => {
  const dir = path.join(
    chatMediaRoot,
    String(productCode || 'FOOTBALL').toLowerCase(),
    String(chatId),
  )
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export const createChatMediaUploader = (productCode, chatId) => {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, ensureChatMediaDir(productCode, chatId))
      } catch (err) {
        cb(err)
      }
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      const ext = path.extname(file.originalname) || extForMime(file.mimetype) || '.bin'
      cb(null, `${unique}${ext}`)
    },
  })

  return multer({
    storage,
    limits: {
      files: CHAT_ALBUM_MAX_ITEMS,
      fileSize: 1024 * 1024 * 1024, // 1 GiB / file
    },
  })
}

export const publicUrlForChatFile = (productCode, chatId, filename) =>
  `/uploads/chats/${String(productCode || 'FOOTBALL').toLowerCase()}/${chatId}/${filename}`

export const normalizeMessageType = (raw) => {
  const type = String(raw || 'TEXT')
    .trim()
    .toUpperCase()
  if (type === 'TEXT' || CHAT_MEDIA_TYPES.has(type)) return type
  const error = new Error(
    'type must be TEXT, IMAGE, VOICE, VIDEO, VIDEO_NOTE, or ALBUM',
  )
  error.statusCode = 400
  throw error
}

/**
 * Автоопределение типа по набору mime, если клиент прислал ALBUM/IMAGE/VIDEO неточно.
 * - только картинки → IMAGE
 * - только видео → VIDEO
 * - микс → ALBUM
 */
export const resolveAlbumTypeFromMimes = (mimes, requestedType) => {
  const requested = normalizeMessageType(requestedType || 'ALBUM')
  if (!['IMAGE', 'VIDEO', 'ALBUM'].includes(requested)) return requested

  const list = (mimes || []).map((m) => String(m || '').toLowerCase())
  if (list.length === 0) return requested

  const allImages = list.every(isImageMime)
  const allVideos = list.every(isVideoMime)
  if (allImages) return 'IMAGE'
  if (allVideos) return 'VIDEO'
  return 'ALBUM'
}

export const assertMimeMatchesType = (type, mime) => {
  const m = String(mime || '').toLowerCase()
  if (type === 'IMAGE' && !isImageMime(m)) {
    const error = new Error(`Unsupported image mime: ${mime}`)
    error.statusCode = 400
    throw error
  }
  if (type === 'VOICE' && !(AUDIO_MIME.has(m) || m.startsWith('audio/'))) {
    const error = new Error(`Unsupported voice mime: ${mime}`)
    error.statusCode = 400
    throw error
  }
  if (type === 'VIDEO' && !isVideoMime(m)) {
    const error = new Error(`Unsupported video mime: ${mime}`)
    error.statusCode = 400
    throw error
  }
  if (type === 'VIDEO_NOTE' && !isVideoMime(m)) {
    const error = new Error(`Unsupported video mime: ${mime}`)
    error.statusCode = 400
    throw error
  }
  if (type === 'ALBUM' && !(isImageMime(m) || isVideoMime(m))) {
    const error = new Error(`ALBUM items must be image or video, got: ${mime}`)
    error.statusCode = 400
    throw error
  }
}

export const assertAlbumItemCount = (count, type) => {
  const n = Number(count) || 0
  if (['IMAGE', 'VIDEO', 'ALBUM'].includes(type)) {
    if (n < 1) {
      const error = new Error(`${type} requires at least 1 media item`)
      error.statusCode = 400
      throw error
    }
    if (n > CHAT_ALBUM_MAX_ITEMS) {
      const error = new Error(
        `${type} allows at most ${CHAT_ALBUM_MAX_ITEMS} items per message`,
      )
      error.statusCode = 400
      throw error
    }
  }
}

export const parseDurationMs = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    const error = new Error('durationMs must be a non-negative number')
    error.statusCode = 400
    throw error
  }
  return Math.round(value)
}

export const parseOptionalInt = (raw, name) => {
  if (raw === undefined || raw === null || raw === '') return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    const error = new Error(`${name} must be a non-negative integer`)
    error.statusCode = 400
    throw error
  }
  return value
}

export const assertVideoNoteRules = ({ durationMs, clientPlatform }) => {
  const platform = String(clientPlatform || '')
    .trim()
    .toLowerCase()
  if (['desktop', 'web', 'windows', 'macos', 'linux'].includes(platform)) {
    const error = new Error('VIDEO_NOTE recording is not available on desktop')
    error.statusCode = 403
    throw error
  }
  if (durationMs == null) {
    const error = new Error('durationMs is required for VIDEO_NOTE')
    error.statusCode = 400
    throw error
  }
  if (durationMs > VIDEO_NOTE_MAX_DURATION_MS) {
    const error = new Error('VIDEO_NOTE duration must be at most 60 seconds')
    error.statusCode = 400
    throw error
  }
}

export const normalizeMediaUrlList = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  const single = String(value || '').trim()
  return single ? [single] : []
}

export const isAllowedChatMediaUrl = (url, chatId, productCode) => {
  const value = String(url || '').trim()
  if (!value.startsWith('/uploads/chats/')) return false
  const expected = `/uploads/chats/${String(productCode || 'FOOTBALL').toLowerCase()}/${chatId}/`
  return value.startsWith(expected) && !value.includes('..')
}

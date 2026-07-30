import { WebSocketServer, WebSocket } from 'ws'
import prisma from '../prisma.js'
import { verifyToken } from './auth.js'
import {
  buildChatLastReadPatch,
  createChatTextMessage,
  getDirectChatByIdForUser,
  getDirectChatInclude,
  serializeChatMessage,
  serializeDirectChat,
} from './chats.js'

const clientsByUserId = new Map()
let wss

const sendJson = (ws, payload) => {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify(payload))
}

const parseJson = (raw) => {
  try {
    return JSON.parse(String(raw))
  } catch (_err) {
    return null
  }
}

const getTokenFromRequest = (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const queryToken = url.searchParams.get('token')
  if (queryToken) return queryToken

  const protocol = req.headers['sec-websocket-protocol']
  if (protocol) {
    const tokens = String(protocol)
      .split(',')
      .map((item) => item.trim())
    const bearerToken = tokens.find((item) => item.startsWith('bearer.'))
    if (bearerToken) return bearerToken.slice('bearer.'.length)
  }

  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7) : ''
}

const addClient = (userId, ws) => {
  const clients = clientsByUserId.get(userId) || new Set()
  clients.add(ws)
  clientsByUserId.set(userId, clients)
}

const removeClient = (userId, ws) => {
  const clients = clientsByUserId.get(userId)
  if (!clients) return
  clients.delete(ws)
  if (clients.size === 0) clientsByUserId.delete(userId)
}

const sendToUser = (userId, payload) => {
  const clients = clientsByUserId.get(userId)
  if (!clients) return
  clients.forEach((client) => sendJson(client, payload))
}

export const broadcastToUser = (userId, payload) => {
  sendToUser(userId, payload)
}

const getParticipantIds = (chat) => [chat.userAId, chat.userBId].filter(Boolean)

const broadcastChatSnapshot = async (chatId, type = 'chat:updated', extra = {}) => {
  const chat = await prisma.directChat.findUnique({
    where: { id: chatId },
    include: getDirectChatInclude(),
  })
  if (!chat) return

  await Promise.all(
    getParticipantIds(chat).map(async (userId) => {
      sendToUser(userId, {
        type,
        chatId: chat.id,
        chat: await serializeDirectChat(chat, userId),
        ...extra,
      })
    }),
  )
}

export const broadcastChatMessage = async ({ chatId, message, clientMessageId }) => {
  const chat = await prisma.directChat.findUnique({
    where: { id: chatId },
    include: getDirectChatInclude(),
  })
  if (!chat) return

  await Promise.all(
    getParticipantIds(chat).map(async (userId) => {
      sendToUser(userId, {
        type: 'chat:message',
        chatId: chat.id,
        message: serializeChatMessage(message),
        chat: await serializeDirectChat(chat, userId),
        clientMessageId: clientMessageId || null,
      })
    }),
  )
}

export const broadcastChatRead = async ({ chatId, userId, readAt }) => {
  const chat = await prisma.directChat.findUnique({
    where: { id: chatId },
    include: getDirectChatInclude(),
  })
  if (!chat) return

  await Promise.all(
    getParticipantIds(chat).map(async (participantId) => {
      sendToUser(participantId, {
        type: 'chat:read',
        chatId: chat.id,
        userId,
        readAt,
        chat: await serializeDirectChat(chat, participantId),
      })
    }),
  )
}

const handleMessageSend = async (ws, payload) => {
  const chatId = String(payload.chatId || '').trim()
  const text = String(payload.text || '').trim()
  if (!chatId || !text) {
    sendJson(ws, { type: 'error', code: 'BAD_REQUEST', message: 'chatId and text are required' })
    return
  }

  const chat = await getDirectChatByIdForUser(chatId, ws.userId)
  if (!chat) {
    sendJson(ws, { type: 'error', code: 'CHAT_NOT_FOUND', message: 'Chat not found' })
    return
  }

  const message = await createChatTextMessage(chat, ws.userId, text)
  await broadcastChatMessage({
    chatId: chat.id,
    message,
    clientMessageId: payload.clientMessageId,
  })
}

const handleRead = async (ws, payload) => {
  const chatId = String(payload.chatId || '').trim()
  if (!chatId) {
    sendJson(ws, { type: 'error', code: 'BAD_REQUEST', message: 'chatId is required' })
    return
  }

  const chat = await getDirectChatByIdForUser(chatId, ws.userId)
  if (!chat) {
    sendJson(ws, { type: 'error', code: 'CHAT_NOT_FOUND', message: 'Chat not found' })
    return
  }

  const now = new Date()
  await prisma.directChat.update({
    where: { id: chat.id },
    data: buildChatLastReadPatch(chat, ws.userId, now),
  })
  await broadcastChatRead({ chatId: chat.id, userId: ws.userId, readAt: now.toISOString() })
}

const handleSubscribe = async (ws, payload) => {
  const chatId = String(payload.chatId || '').trim()
  if (!chatId) {
    sendJson(ws, { type: 'error', code: 'BAD_REQUEST', message: 'chatId is required' })
    return
  }

  const chat = await getDirectChatByIdForUser(chatId, ws.userId)
  if (!chat) {
    sendJson(ws, { type: 'error', code: 'CHAT_NOT_FOUND', message: 'Chat not found' })
    return
  }

  sendJson(ws, {
    type: 'chat:subscribed',
    chatId: chat.id,
    chat: await serializeDirectChat(chat, ws.userId),
  })
}

const handleIncoming = async (ws, raw) => {
  const payload = parseJson(raw)
  if (!payload || typeof payload.type !== 'string') {
    sendJson(ws, { type: 'error', code: 'BAD_JSON', message: 'Invalid websocket message' })
    return
  }

  try {
    if (payload.type === 'ping') {
      sendJson(ws, { type: 'pong', at: new Date().toISOString() })
      return
    }
    if (payload.type === 'chat:subscribe') {
      await handleSubscribe(ws, payload)
      return
    }
    if (payload.type === 'chat:message:send') {
      await handleMessageSend(ws, payload)
      return
    }
    if (payload.type === 'chat:read') {
      await handleRead(ws, payload)
      return
    }
    sendJson(ws, { type: 'error', code: 'UNKNOWN_TYPE', message: `Unknown message type: ${payload.type}` })
  } catch (err) {
    console.error('Chat websocket handler failed', err)
    sendJson(ws, { type: 'error', code: 'INTERNAL_ERROR', message: 'Internal server error' })
  }
}

export const attachChatRealtime = (server) => {
  wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url || '', 'http://localhost')
    if (url.pathname !== '/api/ws/chats') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
      socket.destroy()
      return
    }

    try {
      const token = getTokenFromRequest(req)
      const payload = verifyToken(token)
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          isBlocked: true,
          blockedUntil: true,
        },
      })
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      const hasActiveBlock =
        user.isBlocked && (!user.blockedUntil || user.blockedUntil > new Date())
      if (hasActiveBlock) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }
      if (socket.destroyed) return

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.userId = payload.sub
        ws.isAlive = true
        const tokenExpiresInMs = Math.max(payload.exp * 1000 - Date.now(), 0)
        ws.tokenExpiryTimer = setTimeout(() => {
          ws.close(4001, 'Access token expired')
        }, tokenExpiresInMs)
        ws.tokenExpiryTimer.unref()
        addClient(payload.sub, ws)
        sendJson(ws, {
          type: 'connected',
          userId: payload.sub,
          at: new Date().toISOString(),
        })
        prisma.userNotification
          .count({
            where: {
              userId: payload.sub,
              readAt: null,
            },
          })
          .then((unreadCount) => {
            sendJson(ws, {
              type: 'notifications:sync',
              unreadCount,
              at: new Date().toISOString(),
            })
          })
          .catch((err) => {
            console.error('Notification websocket sync failed', err)
          })
        ws.on('message', (raw) => handleIncoming(ws, raw))
        ws.on('pong', () => {
          ws.isAlive = true
        })
        const cleanup = () => {
          clearTimeout(ws.tokenExpiryTimer)
          removeClient(payload.sub, ws)
        }
        ws.on('close', cleanup)
        ws.on('error', cleanup)
      })
    } catch (_err) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
  })

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        removeClient(ws.userId, ws)
        ws.terminate()
        return
      }
      ws.isAlive = false
      ws.ping()
    })
  }, 30000)

  wss.on('close', () => clearInterval(heartbeat))
  return wss
}

export const getChatRealtimeStats = () => ({
  connectedUsers: clientsByUserId.size,
  sockets: [...clientsByUserId.values()].reduce((sum, clients) => sum + clients.size, 0),
})

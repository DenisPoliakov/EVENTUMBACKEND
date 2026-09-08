import prisma from '../prisma.js'
import { redactUserForViewer, resolveFriendshipFlag } from './privacy.js'
import {
  CHAT_REACTION_MAX_PER_USER,
  normalizeReactionEmoji,
} from './chatReactions.js'

const directChatInclude = {
  userA: {
    include: {
      city: true,
      coachProfile: {
        include: {
          club: {
            include: {
              city: true,
              sport: true,
            },
          },
        },
      },
    },
  },
  userB: {
    include: {
      city: true,
      coachProfile: {
        include: {
          club: {
            include: {
              city: true,
              sport: true,
            },
          },
        },
      },
    },
  },
  messages: {
    where: { deletedAt: null },
    include: {
      sender: {
        include: {
          city: true,
          coachProfile: {
            include: {
              club: {
                include: {
                  city: true,
                  sport: true,
                },
              },
            },
          },
        },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
}

export const messageInclude = {
  sender: {
    include: {
      city: true,
      coachProfile: {
        include: {
          club: {
            include: {
              city: true,
              sport: true,
            },
          },
        },
      },
    },
  },
  replyTo: {
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  },
  reactions: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
}

const serializeReactionUser = (user) => {
  if (!user) return null
  const photoUrl = user.avatarUrl || ''
  return {
    id: user.id,
    username: user.username || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    avatarUrl: photoUrl,
    photoUrl,
  }
}

export const serializeMessageReactions = (reactions = [], viewerId = null) => {
  const byEmoji = new Map()
  for (const reaction of reactions) {
    const emoji = reaction.emoji
    if (!byEmoji.has(emoji)) {
      byEmoji.set(emoji, {
        emoji,
        count: 0,
        reactedByMe: false,
        users: [],
      })
    }
    const bucket = byEmoji.get(emoji)
    bucket.count += 1
    if (viewerId && reaction.userId === viewerId) bucket.reactedByMe = true
    if (reaction.user) bucket.users.push(serializeReactionUser(reaction.user))
  }
  return [...byEmoji.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.emoji.localeCompare(b.emoji)
  })
}

export const normalizeDirectPair = (leftUserId, rightUserId) =>
  [String(leftUserId || '').trim(), String(rightUserId || '').trim()].sort((a, b) =>
    a.localeCompare(b),
  )

export const isChatParticipant = (chat, userId) =>
  Boolean(chat) && (chat.userAId === userId || chat.userBId === userId)

export const getChatLastReadAt = (chat, userId) =>
  chat.userAId === userId ? chat.userALastReadAt : chat.userBLastReadAt

export const buildChatLastReadPatch = (chat, userId, date = new Date()) =>
  chat.userAId === userId ? { userALastReadAt: date } : { userBLastReadAt: date }

export const buildChatDeletedPatch = (chat, userId, date = new Date()) => {
  if (chat.isSelfChat || chat.userAId === chat.userBId) {
    return { userADeletedAt: date, userBDeletedAt: date }
  }
  return chat.userAId === userId ? { userADeletedAt: date } : { userBDeletedAt: date }
}

export const buildChatRestorePatch = (chat, userId) => {
  if (chat.isSelfChat || chat.userAId === chat.userBId) {
    return { userADeletedAt: null, userBDeletedAt: null }
  }
  return chat.userAId === userId ? { userADeletedAt: null } : { userBDeletedAt: null }
}

export const isChatHiddenForUser = (chat, userId) => {
  if (!chat) return true
  if (chat.isSelfChat || chat.userAId === chat.userBId) {
    return Boolean(chat.userADeletedAt || chat.userBDeletedAt)
  }
  return chat.userAId === userId
    ? Boolean(chat.userADeletedAt)
    : Boolean(chat.userBDeletedAt)
}

export const getOtherChatUser = (chat, userId) => {
  if (chat.isSelfChat || chat.userAId === chat.userBId) return chat.userA
  return chat.userAId === userId ? chat.userB : chat.userA
}

export const serializeChatUser = (user, privacyContext = { isSelf: true, isFriend: true }) => {
  if (!user) return null
  const redacted = redactUserForViewer(user, privacyContext)
  const photoUrl =
    redacted.photoUrl ||
    redacted.coachProfile?.photoUrl ||
    redacted.avatarUrl ||
    ''
  return {
    id: redacted.id,
    email: redacted.email,
    username: redacted.username,
    phone: redacted.phone,
    firstName: redacted.firstName,
    lastName: redacted.lastName,
    // Оба поля всегда заполняем одинаково — клиент/сокет не «теряют» аватар при replace.
    avatarUrl: photoUrl,
    photoUrl,
    isCoach: redacted.isCoach,
    coachProfile: redacted.coachProfile
      ? {
          ...redacted.coachProfile,
          photoUrl: redacted.coachProfile.photoUrl || photoUrl,
        }
      : null,
    profileVisibility: redacted.profileVisibility,
    privacy: redacted.privacy,
  }
}

export const CHAT_PIN_MAX = 20
export const CHAT_MEDIA_TYPES = ['IMAGE', 'VOICE', 'VIDEO', 'VIDEO_NOTE', 'ALBUM']

export const resolveMessageDeleteScope = (raw, { fallback = 'everyone' } = {}) => {
  const value = String(raw ?? fallback)
    .trim()
    .toLowerCase()
  if (['me', 'self', 'for_me', 'for-me'].includes(value)) return 'me'
  if (['everyone', 'both', 'all', 'for_everyone', 'for-everyone'].includes(value)) {
    return 'everyone'
  }
  return null
}

export const messageVisibleWhereForUser = (chat, userId) => {
  const base = {
    chatId: chat.id,
    deletedAt: null,
  }
  if (chat.isSelfChat || chat.userAId === chat.userBId) {
    return { ...base, hiddenForUserAAt: null }
  }
  if (chat.userAId === userId) {
    return { ...base, hiddenForUserAAt: null }
  }
  return { ...base, hiddenForUserBAt: null }
}

const hidePatchForUser = (chat, userId, date = new Date()) => {
  if (chat.isSelfChat || chat.userAId === chat.userBId) {
    return { hiddenForUserAAt: date, hiddenForUserBAt: date }
  }
  return chat.userAId === userId
    ? { hiddenForUserAAt: date }
    : { hiddenForUserBAt: date }
}

export const serializeChatMessage = (message, { viewerId = null } = {}) => {
  const deleted = Boolean(message.deletedAt)
  const reply = message.replyTo
  return {
    id: message.id,
    chatId: message.chatId,
    senderUserId: message.senderUserId,
    type: message.type,
    text: deleted ? '' : message.text || '',
    replyToMessageId: message.replyToMessageId || null,
    replyTo: reply
      ? {
          id: reply.id,
          type: reply.type,
          text: reply.deletedAt ? '' : reply.text || '',
          isDeleted: Boolean(reply.deletedAt),
          mediaUrls: reply.deletedAt ? [] : reply.mediaUrls || [],
          senderUserId: reply.senderUserId,
          sender: reply.sender
            ? {
                id: reply.sender.id,
                username: reply.sender.username || '',
                firstName: reply.sender.firstName || '',
                lastName: reply.sender.lastName || '',
                avatarUrl: reply.sender.avatarUrl || '',
                photoUrl: reply.sender.avatarUrl || '',
              }
            : null,
        }
      : null,
    mediaUrls: deleted ? [] : message.mediaUrls || [],
    mediaMimeTypes: deleted ? [] : message.mediaMimeTypes || [],
    mediaBytes: deleted ? [] : message.mediaBytes || [],
    durationMs: deleted ? null : message.durationMs ?? null,
    thumbnailUrl: deleted ? '' : message.thumbnailUrl || '',
    width: deleted ? null : message.width ?? null,
    height: deleted ? null : message.height ?? null,
    isRound: Boolean(message.isRound) || message.type === 'VIDEO_NOTE',
    editedAt: message.editedAt || null,
    deletedAt: message.deletedAt || null,
    isDeleted: deleted,
    pinnedAt: message.pinnedAt || null,
    pinnedByUserId: message.pinnedByUserId || null,
    isPinned: Boolean(message.pinnedAt),
    reactions: deleted
      ? []
      : serializeMessageReactions(message.reactions || [], viewerId),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    sender: message.sender
      ? serializeChatUser(message.sender, { isSelf: true, isFriend: true })
      : null,
  }
}

export const flattenChatMediaItems = (messages) => {
  const items = []
  for (const message of messages) {
    if (message.deletedAt) continue
    const urls = message.mediaUrls || []
    for (let index = 0; index < urls.length; index += 1) {
      items.push({
        messageId: message.id,
        chatId: message.chatId,
        senderUserId: message.senderUserId,
        type: message.type,
        index,
        url: urls[index],
        mimeType: message.mediaMimeTypes?.[index] || '',
        bytes: message.mediaBytes?.[index] ?? null,
        durationMs: message.durationMs ?? null,
        thumbnailUrl: message.thumbnailUrl || '',
        width: message.width ?? null,
        height: message.height ?? null,
        isRound: Boolean(message.isRound) || message.type === 'VIDEO_NOTE',
        createdAt: message.createdAt,
      })
    }
  }
  return items
}

const serializeChatUserForViewer = async (user, viewerId) => {
  if (!user) return null
  const flags = await resolveFriendshipFlag(viewerId, user.id)
  return serializeChatUser(user, flags)
}

export const serializeDirectChat = async (chat, currentUserId) => {
  const otherUser = getOtherChatUser(chat, currentUserId)
  const lastReadAt = getChatLastReadAt(chat, currentUserId)
  const isSelfChat = Boolean(chat.isSelfChat || chat.userAId === chat.userBId)
  const visibleWhere = messageVisibleWhereForUser(chat, currentUserId)

  const lastVisible =
    chat.messages?.[0] &&
    !chat.messages[0].deletedAt &&
    ((isSelfChat && !chat.messages[0].hiddenForUserAAt) ||
      (chat.userAId === currentUserId && !chat.messages[0].hiddenForUserAAt) ||
      (chat.userBId === currentUserId && !chat.messages[0].hiddenForUserBAt))
      ? chat.messages[0]
      : await prisma.chatMessage.findFirst({
          where: visibleWhere,
          include: messageInclude,
          orderBy: { createdAt: 'desc' },
        })

  const unreadCount = await prisma.chatMessage.count({
    where: {
      ...visibleWhere,
      senderUserId: isSelfChat ? undefined : { not: currentUserId },
      createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
    },
  })

  const pinnedCount = await prisma.chatMessage.count({
    where: {
      ...visibleWhere,
      pinnedAt: { not: null },
    },
  })

  return {
    id: chat.id,
    productCode: chat.productCode || 'FOOTBALL',
    isSelfChat,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    lastReadAt,
    unreadCount: isSelfChat ? 0 : unreadCount,
    pinnedCount,
    otherUser: await serializeChatUserForViewer(otherUser, currentUserId),
    lastMessage: lastVisible
      ? serializeChatMessage(lastVisible, { viewerId: currentUserId })
      : null,
  }
}

export const participantWhereForUser = (userId, productCode) => ({
  productCode,
  OR: [
    { userAId: userId, userADeletedAt: null },
    { userBId: userId, userBDeletedAt: null },
  ],
})

export const getDirectChatByIdForUser = async (chatId, userId) =>
  prisma.directChat.findFirst({
    where: {
      id: chatId,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: directChatInclude,
  })

export const createChatTextMessage = async (chat, senderUserId, text, extras = {}) =>
  createChatMessage(chat, senderUserId, {
    type: 'TEXT',
    text,
    ...extras,
  })

export const createChatMessage = async (chat, senderUserId, payload) => {
  const now = new Date()
  const type = payload.type || 'TEXT'
  const text = String(payload.text || '').trim()
  const mediaUrls = Array.isArray(payload.mediaUrls) ? payload.mediaUrls.filter(Boolean) : []
  const mediaMimeTypes = Array.isArray(payload.mediaMimeTypes)
    ? payload.mediaMimeTypes
    : []
  const mediaBytes = Array.isArray(payload.mediaBytes) ? payload.mediaBytes : []
  const replyToMessageId = payload.replyToMessageId
    ? String(payload.replyToMessageId).trim()
    : null

  if (type === 'TEXT' && !text) {
    const error = new Error('text is required for TEXT messages')
    error.statusCode = 400
    throw error
  }
  if (type !== 'TEXT' && mediaUrls.length === 0) {
    const error = new Error('media is required for media messages')
    error.statusCode = 400
    throw error
  }
  if (['IMAGE', 'VIDEO', 'ALBUM'].includes(type)) {
    if (mediaUrls.length < 1 || mediaUrls.length > 10) {
      const error = new Error(`${type} allows 1..10 media items per message`)
      error.statusCode = 400
      throw error
    }
  }
  if ((type === 'VOICE' || type === 'VIDEO_NOTE') && mediaUrls.length !== 1) {
    const error = new Error(`${type} requires exactly one media file`)
    error.statusCode = 400
    throw error
  }

  if (replyToMessageId) {
    const replyTarget = await prisma.chatMessage.findFirst({
      where: {
        id: replyToMessageId,
        chatId: chat.id,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!replyTarget) {
      const error = new Error('replyToMessageId not found in this chat')
      error.statusCode = 400
      throw error
    }
  }

  return prisma.$transaction(async (tx) => {
    const message = await tx.chatMessage.create({
      data: {
        chatId: chat.id,
        senderUserId,
        type,
        text,
        replyToMessageId,
        mediaUrls,
        mediaMimeTypes,
        mediaBytes,
        durationMs: payload.durationMs ?? null,
        thumbnailUrl: payload.thumbnailUrl || null,
        width: payload.width ?? null,
        height: payload.height ?? null,
        isRound: Boolean(payload.isRound) || type === 'VIDEO_NOTE',
      },
      include: messageInclude,
    })

    await tx.directChat.update({
      where: { id: chat.id },
      data: {
        ...buildChatLastReadPatch(chat, senderUserId, now),
        ...buildChatRestorePatch(chat, senderUserId),
        updatedAt: now,
      },
    })

    return message
  })
}

export const editChatTextMessage = async (chat, messageId, senderUserId, text) => {
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      chatId: chat.id,
      senderUserId,
      deletedAt: null,
    },
  })
  if (!message) {
    const error = new Error('Message not found')
    error.statusCode = 404
    throw error
  }

  return prisma.chatMessage.update({
    where: { id: message.id },
    data: {
      text,
      editedAt: new Date(),
    },
    include: messageInclude,
  })
}

export const softDeleteChatMessage = async (
  chat,
  messageId,
  userId,
  { scope = 'everyone' } = {},
) => {
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      ...messageVisibleWhereForUser(chat, userId),
    },
  })
  if (!message) {
    const error = new Error('Message not found')
    error.statusCode = 404
    throw error
  }

  if (scope === 'me') {
    return {
      scope: 'me',
      message: await prisma.chatMessage.update({
        where: { id: message.id },
        data: hidePatchForUser(chat, userId),
        include: messageInclude,
      }),
    }
  }

  if (message.senderUserId !== userId) {
    const error = new Error('Only the sender can delete a message for everyone')
    error.statusCode = 403
    throw error
  }

  return {
    scope: 'everyone',
    message: await prisma.chatMessage.update({
      where: { id: message.id },
      data: {
        deletedAt: new Date(),
        pinnedAt: null,
        pinnedByUserId: null,
      },
      include: messageInclude,
    }),
  }
}

export const pinChatMessage = async (chat, messageId, userId) => {
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      ...messageVisibleWhereForUser(chat, userId),
    },
  })
  if (!message) {
    const error = new Error('Message not found')
    error.statusCode = 404
    throw error
  }
  if (message.pinnedAt) {
    return prisma.chatMessage.findFirst({
      where: { id: message.id },
      include: messageInclude,
    })
  }

  const pinnedCount = await prisma.chatMessage.count({
    where: {
      chatId: chat.id,
      deletedAt: null,
      pinnedAt: { not: null },
    },
  })
  if (pinnedCount >= CHAT_PIN_MAX) {
    const error = new Error(`At most ${CHAT_PIN_MAX} pinned messages per chat`)
    error.statusCode = 400
    throw error
  }

  return prisma.chatMessage.update({
    where: { id: message.id },
    data: {
      pinnedAt: new Date(),
      pinnedByUserId: userId,
    },
    include: messageInclude,
  })
}

export const unpinChatMessage = async (chat, messageId, userId) => {
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      chatId: chat.id,
      deletedAt: null,
      pinnedAt: { not: null },
    },
  })
  if (!message) {
    const error = new Error('Pinned message not found')
    error.statusCode = 404
    throw error
  }
  if (chat.userAId !== userId && chat.userBId !== userId) {
    const error = new Error('Forbidden')
    error.statusCode = 403
    throw error
  }

  return prisma.chatMessage.update({
    where: { id: message.id },
    data: {
      pinnedAt: null,
      pinnedByUserId: null,
    },
    include: messageInclude,
  })
}

/**
 * Toggle: тот же emoji повторно → снять; иначе добавить.
 * Лимит: до CHAT_REACTION_MAX_PER_USER разных emoji от одного юзера на сообщение.
 */
export const toggleChatMessageReaction = async (chat, messageId, userId, rawEmoji) => {
  const emoji = normalizeReactionEmoji(rawEmoji)
  if (!emoji) {
    const error = new Error('emoji must be a single standard Unicode emoji')
    error.statusCode = 400
    throw error
  }

  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      ...messageVisibleWhereForUser(chat, userId),
    },
    select: { id: true },
  })
  if (!message) {
    const error = new Error('Message not found')
    error.statusCode = 404
    throw error
  }

  const existing = await prisma.chatMessageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId: message.id,
        userId,
        emoji,
      },
    },
  })

  let action
  if (existing) {
    await prisma.chatMessageReaction.delete({ where: { id: existing.id } })
    action = 'removed'
  } else {
    const myEmojis = await prisma.chatMessageReaction.findMany({
      where: { messageId: message.id, userId },
      select: { emoji: true },
      distinct: ['emoji'],
    })
    if (myEmojis.length >= CHAT_REACTION_MAX_PER_USER) {
      const error = new Error(
        `At most ${CHAT_REACTION_MAX_PER_USER} different reactions per user on a message`,
      )
      error.statusCode = 400
      throw error
    }
    await prisma.chatMessageReaction.create({
      data: {
        messageId: message.id,
        userId,
        emoji,
      },
    })
    action = 'added'
  }

  const full = await prisma.chatMessage.findUnique({
    where: { id: message.id },
    include: messageInclude,
  })
  return { action, emoji, message: full }
}

export const removeChatMessageReaction = async (chat, messageId, userId, rawEmoji) => {
  const emoji = normalizeReactionEmoji(rawEmoji)
  if (!emoji) {
    const error = new Error('emoji must be a single standard Unicode emoji')
    error.statusCode = 400
    throw error
  }

  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      ...messageVisibleWhereForUser(chat, userId),
    },
    select: { id: true },
  })
  if (!message) {
    const error = new Error('Message not found')
    error.statusCode = 404
    throw error
  }

  const deleted = await prisma.chatMessageReaction.deleteMany({
    where: {
      messageId: message.id,
      userId,
      emoji,
    },
  })
  if (!deleted.count) {
    const error = new Error('Reaction not found')
    error.statusCode = 404
    throw error
  }

  const full = await prisma.chatMessage.findUnique({
    where: { id: message.id },
    include: messageInclude,
  })
  return { action: 'removed', emoji, message: full }
}

export const softDeleteDirectChatForUser = async (chat, userId) => {
  const now = new Date()
  return prisma.directChat.update({
    where: { id: chat.id },
    data: buildChatDeletedPatch(chat, userId, now),
    include: directChatInclude,
  })
}

export const getDirectChatInclude = () => directChatInclude

export const createOrGetDirectChat = async (
  currentUserId,
  targetUserId,
  productCode = 'FOOTBALL',
  { isSelfChat = false } = {},
) => {
  const self = Boolean(isSelfChat || currentUserId === targetUserId)
  const [userAId, userBId] = self
    ? [currentUserId, currentUserId]
    : normalizeDirectPair(currentUserId, targetUserId)
  const now = new Date()

  const existing = await prisma.directChat.findUnique({
    where: {
      userAId_userBId_productCode: {
        userAId,
        userBId,
        productCode,
      },
    },
    include: directChatInclude,
  })

  if (existing) {
    return prisma.directChat.update({
      where: { id: existing.id },
      data: {
        isSelfChat: self || existing.isSelfChat,
        ...buildChatLastReadPatch(existing, currentUserId, now),
        ...buildChatRestorePatch(existing, currentUserId),
      },
      include: directChatInclude,
    })
  }

  return prisma.directChat.create({
    data: {
      userAId,
      userBId,
      productCode,
      isSelfChat: self,
      ...(userAId === currentUserId || self
        ? { userALastReadAt: now }
        : { userBLastReadAt: now }),
    },
    include: directChatInclude,
  })
}

export const findDirectChatIdForPair = async (
  leftUserId,
  rightUserId,
  productCode = 'FOOTBALL',
) => {
  const [userAId, userBId] = normalizeDirectPair(leftUserId, rightUserId)
  const chat = await prisma.directChat.findUnique({
    where: {
      userAId_userBId_productCode: {
        userAId,
        userBId,
        productCode,
      },
    },
    select: { id: true },
  })
  return chat?.id || null
}

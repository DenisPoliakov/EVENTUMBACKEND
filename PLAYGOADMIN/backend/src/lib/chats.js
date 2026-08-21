import prisma from '../prisma.js'
import { redactUserForViewer, resolveFriendshipFlag } from './privacy.js'

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
  return {
    id: redacted.id,
    email: redacted.email,
    username: redacted.username,
    phone: redacted.phone,
    firstName: redacted.firstName,
    lastName: redacted.lastName,
    avatarUrl: redacted.avatarUrl || '',
    isCoach: redacted.isCoach,
    coachProfile: redacted.coachProfile,
    profileVisibility: redacted.profileVisibility,
    privacy: redacted.privacy,
  }
}

export const serializeChatMessage = (message) => {
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
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    sender: message.sender
      ? serializeChatUser(message.sender, { isSelf: true, isFriend: true })
      : null,
  }
}

const serializeChatUserForViewer = async (user, viewerId) => {
  if (!user) return null
  const flags = await resolveFriendshipFlag(viewerId, user.id)
  return serializeChatUser(user, flags)
}

export const serializeDirectChat = async (chat, currentUserId) => {
  const otherUser = getOtherChatUser(chat, currentUserId)
  const lastReadAt = getChatLastReadAt(chat, currentUserId)
  const lastMessage = chat.messages?.[0] ? serializeChatMessage(chat.messages[0]) : null
  const isSelfChat = Boolean(chat.isSelfChat || chat.userAId === chat.userBId)

  const unreadCount = await prisma.chatMessage.count({
    where: {
      chatId: chat.id,
      deletedAt: null,
      senderUserId: isSelfChat ? undefined : { not: currentUserId },
      createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
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
    otherUser: await serializeChatUserForViewer(otherUser, currentUserId),
    lastMessage,
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

export const softDeleteChatMessage = async (chat, messageId, senderUserId) => {
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
      deletedAt: new Date(),
    },
    include: messageInclude,
  })
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

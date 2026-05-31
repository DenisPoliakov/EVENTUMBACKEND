import prisma from '../prisma.js'

const directChatInclude = {
  userA: {
    include: {
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
    include: {
      sender: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
}

export const messageInclude = {
  sender: {
    include: {
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

export const getOtherChatUser = (chat, userId) => (chat.userAId === userId ? chat.userB : chat.userA)

const serializeCoachPreview = (coachProfile) =>
  coachProfile
    ? {
        id: coachProfile.id,
        clubId: coachProfile.clubId || '',
        firstName: coachProfile.firstName,
        lastName: coachProfile.lastName,
        experienceYears: coachProfile.experienceYears,
        photoUrl: coachProfile.photoUrl || '',
        maxUrl: coachProfile.maxUrl || '',
        telegramUrl: coachProfile.telegramUrl || '',
        club: coachProfile.club
          ? {
              id: coachProfile.club.id,
              name: coachProfile.club.name,
              city: coachProfile.club.city?.name || '',
              sport: coachProfile.club.sport
                ? {
                    id: coachProfile.club.sport.id,
                    code: coachProfile.club.sport.code,
                    name: coachProfile.club.sport.name,
                  }
                : null,
            }
          : null,
      }
    : null

export const serializeChatUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username || '',
  phone: user.phone || '',
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  isCoach: Boolean(user.coachProfile),
  coachProfile: serializeCoachPreview(user.coachProfile),
})

export const serializeChatMessage = (message) => ({
  id: message.id,
  chatId: message.chatId,
  senderUserId: message.senderUserId,
  type: message.type,
  text: message.text,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
  sender: message.sender ? serializeChatUser(message.sender) : null,
})

export const serializeDirectChat = async (chat, currentUserId) => {
  const otherUser = getOtherChatUser(chat, currentUserId)
  const lastReadAt = getChatLastReadAt(chat, currentUserId)
  const lastMessage = chat.messages?.[0] ? serializeChatMessage(chat.messages[0]) : null

  const unreadCount = await prisma.chatMessage.count({
    where: {
      chatId: chat.id,
      senderUserId: { not: currentUserId },
      createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
    },
  })

  return {
    id: chat.id,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    lastReadAt,
    unreadCount,
    otherUser: otherUser ? serializeChatUser(otherUser) : null,
    lastMessage,
  }
}

export const getDirectChatByIdForUser = async (chatId, userId) =>
  prisma.directChat.findFirst({
    where: {
      id: chatId,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: directChatInclude,
  })

export const createChatTextMessage = async (chat, senderUserId, text) => {
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const message = await tx.chatMessage.create({
      data: {
        chatId: chat.id,
        senderUserId,
        text,
        type: 'TEXT',
      },
      include: messageInclude,
    })

    await tx.directChat.update({
      where: { id: chat.id },
      data: {
        ...buildChatLastReadPatch(chat, senderUserId, now),
        updatedAt: now,
      },
    })

    return message
  })
}

export const getDirectChatInclude = () => directChatInclude

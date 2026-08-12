import prisma from '../prisma.js'
import { createOrGetDirectChat, findDirectChatIdForPair, serializeChatUser } from './chats.js'
import { createNotificationWithPush } from './pushNotifications.js'

export const displayUserName = (user) => {
  const full = `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
  if (full) return full
  if (user?.name?.trim()) return user.name.trim()
  if (user?.username) return `@${user.username}`
  return 'Пользователь'
}

const friendshipUserInclude = {
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
}

export const friendshipInclude = {
  requester: { include: friendshipUserInclude },
  addressee: { include: friendshipUserInclude },
}

export const listLimit = (value, fallback = 30, max = 50) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 1), max)
}

export const getOtherFriendshipUser = (friendship, currentUserId) =>
  friendship.requesterId === currentUserId ? friendship.addressee : friendship.requester

export const friendshipRelationFor = (friendship, currentUserId) => {
  if (!friendship) return 'NONE'
  if (friendship.status === 'ACCEPTED') return 'FRIENDS'
  if (friendship.status === 'REJECTED') return 'NONE'
  if (friendship.requesterId === currentUserId) return 'PENDING_OUTGOING'
  if (friendship.addresseeId === currentUserId) return 'PENDING_INCOMING'
  return 'NONE'
}

export const findFriendshipBetween = async (leftUserId, rightUserId) =>
  prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: leftUserId, addresseeId: rightUserId },
        { requesterId: rightUserId, addresseeId: leftUserId },
      ],
    },
    include: friendshipInclude,
  })

export const serializePublicUser = (user) => serializeChatUser(user)

export const serializeFriendship = async (friendship, currentUserId) => {
  const otherUser = getOtherFriendshipUser(friendship, currentUserId)
  const chatId =
    friendship.status === 'ACCEPTED' && otherUser
      ? await findDirectChatIdForPair(currentUserId, otherUser.id)
      : null

  return {
    id: friendship.id,
    status: friendship.status,
    relation: friendshipRelationFor(friendship, currentUserId),
    requesterId: friendship.requesterId,
    addresseeId: friendship.addresseeId,
    createdAt: friendship.createdAt,
    updatedAt: friendship.updatedAt,
    respondedAt: friendship.respondedAt,
    user: otherUser ? serializePublicUser(otherUser) : null,
    chatId,
  }
}

export const serializeUserSearchHit = async (user, currentUserId) => {
  const friendship = await findFriendshipBetween(currentUserId, user.id)
  const relation = friendshipRelationFor(friendship, currentUserId)
  const chatId =
    relation === 'FRIENDS' ? await findDirectChatIdForPair(currentUserId, user.id) : null

  return {
    user: serializePublicUser(user),
    friendshipId: friendship?.id || null,
    friendshipStatus: friendship?.status || null,
    relation,
    chatId,
  }
}

export const ensureTargetUser = async (targetUserId, currentUserId) => {
  const normalized = String(targetUserId || '').trim()
  if (!normalized) {
    const error = new Error('userId is required')
    error.statusCode = 400
    throw error
  }
  if (normalized === currentUserId) {
    const error = new Error('Cannot add yourself as a friend')
    error.statusCode = 400
    throw error
  }

  const target = await prisma.user.findUnique({
    where: { id: normalized },
    include: friendshipUserInclude,
  })
  if (!target || target.isBlocked) {
    const error = new Error('User not found')
    error.statusCode = 404
    throw error
  }

  return target
}

export const resolveFriendTargetUserId = async (body = {}) => {
  const direct =
    body.userId ||
    body.addresseeId ||
    body.targetUserId ||
    body.friendUserId ||
    body.id ||
    ''
  const normalizedDirect = String(direct || '').trim()
  if (normalizedDirect) return normalizedDirect

  const username = String(body.username || '').trim()
  if (!username) return ''

  const user = await prisma.user.findFirst({
    where: {
      isBlocked: false,
      username: { equals: username.replace(/^@/, ''), mode: 'insensitive' },
    },
    select: { id: true },
  })
  return user?.id || ''
}

const notifyFriendRequest = async (friendship) => {
  const requester = friendship.requester
  const name = displayUserName(requester)
  await createNotificationWithPush({
    userId: friendship.addresseeId,
    type: 'FRIEND_REQUEST',
    title: 'Новая заявка в друзья',
    body: `${name} хочет добавить вас в друзья`,
    dedupeKey: `friend-request:${friendship.id}`,
    data: {
      friendshipId: friendship.id,
      requesterId: friendship.requesterId,
      addresseeId: friendship.addresseeId,
    },
  })
}

const notifyFriendAccepted = async (friendship, acceptedByUserId) => {
  const acceptor =
    acceptedByUserId === friendship.addresseeId
      ? friendship.addressee
      : friendship.requester
  const recipientId =
    acceptedByUserId === friendship.addresseeId
      ? friendship.requesterId
      : friendship.addresseeId
  const name = displayUserName(acceptor)
  await createNotificationWithPush({
    userId: recipientId,
    type: 'FRIEND_ACCEPTED',
    title: 'Заявка принята',
    body: `${name} принял(а) вашу заявку в друзья`,
    dedupeKey: `friend-accepted:${friendship.id}`,
    data: {
      friendshipId: friendship.id,
      requesterId: friendship.requesterId,
      addresseeId: friendship.addresseeId,
      chatReady: true,
    },
  })
}

export const requestFriendship = async (currentUserId, targetUserId) => {
  const target = await ensureTargetUser(targetUserId, currentUserId)
  const existing = await findFriendshipBetween(currentUserId, target.id)

  if (existing?.status === 'ACCEPTED') {
    const error = new Error('Already friends')
    error.statusCode = 409
    throw error
  }

  if (existing?.status === 'PENDING') {
    if (existing.requesterId === currentUserId) {
      const error = new Error('Friend request already sent')
      error.statusCode = 409
      throw error
    }

    const accepted = await prisma.friendship.update({
      where: { id: existing.id },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
      include: friendshipInclude,
    })
    await createOrGetDirectChat(currentUserId, target.id)
    await notifyFriendAccepted(accepted, currentUserId)
    return accepted
  }

  try {
    if (existing?.status === 'REJECTED') {
      const reopened = await prisma.friendship.update({
        where: { id: existing.id },
        data: {
          requesterId: currentUserId,
          addresseeId: target.id,
          status: 'PENDING',
          respondedAt: null,
        },
        include: friendshipInclude,
      })
      await notifyFriendRequest(reopened)
      return reopened
    }

    const created = await prisma.friendship.create({
      data: {
        requesterId: currentUserId,
        addresseeId: target.id,
        status: 'PENDING',
      },
      include: friendshipInclude,
    })
    await notifyFriendRequest(created)
    return created
  } catch (err) {
    if (err.code === 'P2002') {
      const error = new Error('Friend request already sent')
      error.statusCode = 409
      throw error
    }
    throw err
  }
}

export const acceptFriendship = async (friendshipId, currentUserId) => {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    include: friendshipInclude,
  })
  if (!friendship) {
    const error = new Error('Friend request not found')
    error.statusCode = 404
    throw error
  }
  if (friendship.addresseeId !== currentUserId) {
    const error = new Error('Only the addressee can accept this request')
    error.statusCode = 403
    throw error
  }
  if (friendship.status !== 'PENDING') {
    const error = new Error('Friend request is not pending')
    error.statusCode = 409
    throw error
  }

  const accepted = await prisma.friendship.update({
    where: { id: friendship.id },
    data: {
      status: 'ACCEPTED',
      respondedAt: new Date(),
    },
    include: friendshipInclude,
  })
  await createOrGetDirectChat(currentUserId, friendship.requesterId)
  await notifyFriendAccepted(accepted, currentUserId)
  return accepted
}

export const rejectFriendship = async (friendshipId, currentUserId) => {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    include: friendshipInclude,
  })
  if (!friendship) {
    const error = new Error('Friend request not found')
    error.statusCode = 404
    throw error
  }
  if (friendship.addresseeId !== currentUserId) {
    const error = new Error('Only the addressee can reject this request')
    error.statusCode = 403
    throw error
  }
  if (friendship.status !== 'PENDING') {
    const error = new Error('Friend request is not pending')
    error.statusCode = 409
    throw error
  }

  return prisma.friendship.update({
    where: { id: friendship.id },
    data: {
      status: 'REJECTED',
      respondedAt: new Date(),
    },
    include: friendshipInclude,
  })
}

export const removeFriendship = async (currentUserId, otherUserId) => {
  const friendship = await findFriendshipBetween(currentUserId, otherUserId)
  if (!friendship) {
    const error = new Error('Friendship not found')
    error.statusCode = 404
    throw error
  }

  await prisma.friendship.delete({ where: { id: friendship.id } })
  return friendship
}

export const searchUsersByUsername = async ({ query, currentUserId, limit }) => {
  const q = String(query || '').trim()
  if (q.length < 1) {
    const error = new Error('username or q is required')
    error.statusCode = 400
    throw error
  }

  const users = await prisma.user.findMany({
    where: {
      isBlocked: false,
      id: { not: currentUserId },
      username: { not: null },
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ username: 'asc' }, { createdAt: 'asc' }],
    take: limit,
    include: friendshipUserInclude,
  })

  return Promise.all(users.map((user) => serializeUserSearchHit(user, currentUserId)))
}

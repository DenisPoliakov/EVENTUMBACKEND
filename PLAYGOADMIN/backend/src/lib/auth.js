import crypto from 'crypto'
import { config } from '../config.js'
import prisma from '../prisma.js'

const base64url = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const decodeBase64url = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
  return Buffer.from(padded, 'base64').toString()
}

const sign = (payload) =>
  base64url(
    crypto.createHmac('sha256', config.jwtSecret).update(payload).digest()
  )

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export const verifyPassword = (password, stored) => {
  const [salt, hash] = (stored || '').split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  const actual = Buffer.from(hash, 'hex')
  return actual.length === candidate.length && crypto.timingSafeEqual(actual, candidate)
}

export const signToken = ({ sub, email, username }) => {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({
      sub,
      email,
      username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + config.accessTokenTtlSeconds,
    })
  )
  const signature = sign(`${header}.${payload}`)
  return `${header}.${payload}.${signature}`
}

export const verifyToken = (token) => {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')
  const [header, payload, signature] = parts
  const expected = sign(`${header}.${payload}`)
  const actual = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) {
    throw new Error('Invalid token signature')
  }
  const parsed = JSON.parse(decodeBase64url(payload))
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }
  return parsed
}

const hashOpaqueToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')

const createRefreshToken = async (userId, client = prisma) => {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlSeconds * 1000)
  await client.refreshToken.create({
    data: { userId, tokenHash: hashOpaqueToken(token), expiresAt },
  })
  return token
}

const serializeAuthUser = (user, cityName = '') => ({
  id: user.id,
  email: user.email,
  username: user.username || '',
  phone: user.phone || '',
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  birthDate: user.birthDate
    ? new Date(user.birthDate).toISOString().slice(0, 10)
    : null,
  city: cityName || user.city?.name || '',
  isBlocked: Boolean(user.isBlocked),
  blockReason: user.blockReason || '',
  blockedUntil: user.blockedUntil || null,
  matchBanUntil: user.matchBanUntil || null,
  hasPlayerCard: Boolean(user.playerCard),
})

export const authResponse = async (user, cityName = '') => ({
  accessToken: signToken({
    sub: user.id,
    email: user.email,
    username: user.username || '',
  }),
  refreshToken: await createRefreshToken(user.id),
  expiresIn: config.accessTokenTtlSeconds,
  user: serializeAuthUser(user, cityName),
})

export const rotateRefreshToken = async (rawToken) => {
  if (!rawToken) return null
  const tokenHash = hashOpaqueToken(rawToken)
  return prisma.$transaction(async (tx) => {
    const stored = await tx.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { city: true, playerCard: true } } },
    })
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt <= new Date() ||
      !stored.user ||
      stored.user.isBlocked &&
        (!stored.user.blockedUntil || stored.user.blockedUntil > new Date())
    ) {
      return null
    }
    const revoked = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (revoked.count !== 1) return null
    const refreshToken = await createRefreshToken(stored.userId, tx)
    return {
      accessToken: signToken({
        sub: stored.user.id,
        email: stored.user.email,
        username: stored.user.username || '',
      }),
      refreshToken,
      expiresIn: config.accessTokenTtlSeconds,
      user: serializeAuthUser(stored.user),
    }
  })
}

export const revokeRefreshToken = async (rawToken) => {
  if (!rawToken) return false
  const result = await prisma.refreshToken.updateMany({
    where: { tokenHash: hashOpaqueToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count === 1
}

export const splitName = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  }
}

export const normalizeIdentifier = (value = '') => value.trim().toLowerCase()

export const generateUsername = (seed = '') => {
  const base = normalizeIdentifier(seed)
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || `user_${crypto.randomBytes(4).toString('hex')}`
}

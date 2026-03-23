import crypto from 'crypto'

const TOKEN_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const TOKEN_TTL_SECONDS = 60 * 60 * 24

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
    crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest()
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
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
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

export const authResponse = (user, cityName = '') => ({
  accessToken: signToken({
    sub: user.id,
    email: user.email,
    username: user.username || '',
  }),
  user: {
    id: user.id,
    email: user.email,
    username: user.username || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    city: cityName || user.city?.name || '',
    isBlocked: Boolean(user.isBlocked),
    blockReason: user.blockReason || '',
    blockedUntil: user.blockedUntil || null,
    matchBanUntil: user.matchBanUntil || null,
    hasPlayerCard: Boolean(user.playerCard),
  },
})

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

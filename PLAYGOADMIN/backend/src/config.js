import 'dotenv/config'

const environment = process.env.NODE_ENV || 'development'
const isProduction = environment === 'production'

const requiredInProduction = (name, developmentDefault) => {
  const value = process.env[name]?.trim()
  if (value) return value
  if (isProduction) {
    throw new Error(`${name} is required when NODE_ENV=production`)
  }
  return developmentDefault
}

const parsePositiveInteger = (name, fallback) => {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

const parseNonNegativeInteger = (name, fallback) => {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  return value
}

const parseCorsOrigins = () =>
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      let url
      try {
        url = new URL(origin)
      } catch {
        throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`)
      }
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== origin ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`)
      }
      return origin
    })

const jwtSecret = requiredInProduction('JWT_SECRET', 'dev-secret-change-me')
const adminUser = requiredInProduction('ADMIN_USER', 'admin')
const adminPassword = requiredInProduction('ADMIN_PASSWORD', 'admin')
const corsOrigins = parseCorsOrigins()
const jsonBodyLimit = process.env.JSON_BODY_LIMIT?.trim() || '256kb'
const yookassaShopId = process.env.YOOKASSA_SHOP_ID?.trim() || ''
const yookassaSecretKey = process.env.YOOKASSA_SECRET_KEY?.trim() || ''
const yookassaReturnUrl =
  process.env.YOOKASSA_RETURN_URL?.trim() || 'http://localhost:3000/payments/return'
const nominatimBaseUrl =
  process.env.NOMINATIM_BASE_URL?.trim() || 'https://nominatim.openstreetmap.org'
const nominatimUserAgent =
  process.env.NOMINATIM_USER_AGENT?.trim() ||
  'EventumClubs/1.0 (https://github.com/DenisPoliakov/EVENTUMBACKEND)'

try {
  const url = new URL(nominatimBaseUrl)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('unsupported protocol')
  }
} catch {
  throw new Error('NOMINATIM_BASE_URL must be a valid HTTP(S) URL')
}

if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production')
}
if (isProduction && adminPassword.length < 12) {
  throw new Error('ADMIN_PASSWORD must be at least 12 characters in production')
}
if (isProduction && corsOrigins.length === 0) {
  throw new Error('CORS_ORIGINS must contain at least one origin in production')
}
if (!/^\d+(?:b|kb|mb)?$/i.test(jsonBodyLimit)) {
  throw new Error('JSON_BODY_LIMIT must be a byte value such as 256kb or 1mb')
}

export const config = Object.freeze({
  environment,
  isProduction,
  port: parsePositiveInteger('PORT', 4000),
  jwtSecret,
  accessTokenTtlSeconds: parsePositiveInteger('ACCESS_TOKEN_TTL_SECONDS', 24 * 60 * 60),
  refreshTokenTtlSeconds: parsePositiveInteger('REFRESH_TOKEN_TTL_SECONDS', 30 * 24 * 60 * 60),
  adminUser,
  adminPassword,
  corsOrigins,
  jsonBodyLimit,
  authRateLimitWindowMs: parsePositiveInteger('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  authRateLimitMax: parsePositiveInteger('AUTH_RATE_LIMIT_MAX', 30),
  yookassaShopId,
  yookassaSecretKey,
  yookassaReturnUrl,
  yookassaApiUrl: process.env.YOOKASSA_API_URL?.trim() || 'https://api.yookassa.ru/v3',
  paymentsConfigured: Boolean(yookassaShopId && yookassaSecretKey),
  premiumPriceCents: parsePositiveInteger('PREMIUM_PRICE_CENTS', 29900),
  premiumDurationDays: parsePositiveInteger('PREMIUM_DURATION_DAYS', 30),
  premiumCurrency: process.env.PREMIUM_CURRENCY?.trim().toUpperCase() || 'RUB',
  referralRewardCents: parseNonNegativeInteger('REFERRAL_REWARD_CENTS', 10000),
  referredBonusPremiumDays: parseNonNegativeInteger(
    'REFERRED_BONUS_PREMIUM_DAYS',
    7,
  ),
  referralApplyWindowHours: parsePositiveInteger(
    'REFERRAL_APPLY_WINDOW_HOURS',
    7 * 24,
  ),
  pushExpiryIntervalMinutes: parseNonNegativeInteger(
    'PUSH_EXPIRY_INTERVAL_MINUTES',
    0,
  ),
  pushExpiryWindowDays: parsePositiveInteger('PUSH_EXPIRY_WINDOW_DAYS', 7),
  pushExpiryBatchSize: parsePositiveInteger('PUSH_EXPIRY_BATCH_SIZE', 250),
  nominatimBaseUrl,
  nominatimUserAgent,
  nominatimEmail: process.env.NOMINATIM_EMAIL?.trim() || '',
  nominatimTimeoutMs: parsePositiveInteger('NOMINATIM_TIMEOUT_MS', 5000),
  nominatimCacheTtlSeconds: parsePositiveInteger(
    'NOMINATIM_CACHE_TTL_SECONDS',
    24 * 60 * 60,
  ),
})

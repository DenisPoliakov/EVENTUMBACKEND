import fetch from 'node-fetch'

import { config } from '../config.js'

const ATTRIBUTION = {
  text: '© OpenStreetMap contributors',
  url: 'https://www.openstreetmap.org/copyright',
}
const PUBLIC_MIN_INTERVAL_MS = 1100
const MAX_CACHE_ENTRIES = 500
const MAX_PENDING_REQUESTS = 10

const cache = new Map()
let requestQueue = Promise.resolve()
let lastRequestStartedAt = 0
let pendingRequests = 0
let fetchImplementation = fetch

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const normalizeText = (value) => String(value || '').trim()

const normalizeCountryCodes = (value) =>
  normalizeText(value)
    .toLowerCase()
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^[a-z]{2}$/.test(item))
    .slice(0, 5)
    .join(',')

const osmPath = (type) => {
  if (type === 'node') return 'node'
  if (type === 'way') return 'way'
  if (type === 'relation') return 'relation'
  return ''
}

const serializePlace = (item) => {
  const latitude = Number(item.lat)
  const longitude = Number(item.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const type = normalizeText(item.osm_type).toLowerCase()
  const osmId = normalizeText(item.osm_id)
  const path = osmPath(type)
  const boundingBox = Array.isArray(item.boundingbox)
    ? item.boundingbox.map(Number).filter(Number.isFinite)
    : []

  return {
    id: path && osmId ? `osm:${path}:${osmId}` : `nominatim:${item.place_id}`,
    source: 'OSM_NOMINATIM',
    name:
      normalizeText(item.name) ||
      normalizeText(item.address?.road) ||
      normalizeText(item.address?.city) ||
      normalizeText(item.display_name),
    displayName: normalizeText(item.display_name),
    category: normalizeText(item.class),
    type: normalizeText(item.type),
    osmType: type,
    osmId,
    latitude,
    longitude,
    boundingBox: boundingBox.length === 4 ? boundingBox : [],
    address: item.address && typeof item.address === 'object' ? item.address : {},
    mapUrl:
      path && osmId
        ? `https://www.openstreetmap.org/${path}/${encodeURIComponent(osmId)}`
        : `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}`,
  }
}

const cacheKeyFor = (options) =>
  JSON.stringify({
    query: options.query.toLocaleLowerCase('ru'),
    city: options.city.toLocaleLowerCase('ru'),
    countryCodes: options.countryCodes,
    language: options.language.toLocaleLowerCase('ru'),
    limit: options.limit,
  })

const getCached = (key) => {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.value
}

const setCached = (key, value) => {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value)
  }
  cache.set(key, {
    value,
    expiresAt: Date.now() + config.nominatimCacheTtlSeconds * 1000,
  })
}

const scheduleRequest = (callback) => {
  if (pendingRequests >= MAX_PENDING_REQUESTS) {
    const error = new Error('Nominatim request queue is full')
    error.statusCode = 503
    throw error
  }
  pendingRequests += 1
  const scheduled = requestQueue.then(async () => {
    const waitMs = Math.max(
      PUBLIC_MIN_INTERVAL_MS - (Date.now() - lastRequestStartedAt),
      0,
    )
    if (waitMs) await sleep(waitMs)
    lastRequestStartedAt = Date.now()
    return callback()
  })
  requestQueue = scheduled
    .finally(() => {
      pendingRequests -= 1
    })
    .catch(() => {})
  return scheduled
}

export const searchNominatimPlaces = async ({
  query,
  city = '',
  countryCodes = 'ru',
  language = 'ru',
  limit = 5,
}) => {
  const normalized = {
    query: normalizeText(query),
    city: normalizeText(city),
    countryCodes: normalizeCountryCodes(countryCodes),
    language: normalizeText(language) || 'ru',
    limit: Math.min(Math.max(Number(limit) || 5, 1), 10),
  }
  if (normalized.query.length < 2) return { places: [], attribution: ATTRIBUTION }

  const key = cacheKeyFor(normalized)
  const cached = getCached(key)
  if (cached) return { ...cached, cached: true }

  return scheduleRequest(async () => {
    const endpoint = new URL(
      'search',
      `${config.nominatimBaseUrl.replace(/\/+$/, '')}/`,
    )
    endpoint.searchParams.set(
      'q',
      normalized.city
        ? `${normalized.query}, ${normalized.city}`
        : normalized.query,
    )
    endpoint.searchParams.set('format', 'jsonv2')
    endpoint.searchParams.set('addressdetails', '1')
    endpoint.searchParams.set('limit', String(normalized.limit))
    endpoint.searchParams.set('accept-language', normalized.language)
    if (normalized.countryCodes) {
      endpoint.searchParams.set('countrycodes', normalized.countryCodes)
    }
    if (config.nominatimEmail) {
      endpoint.searchParams.set('email', config.nominatimEmail)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.nominatimTimeoutMs)
    timeout.unref()
    try {
      const response = await fetchImplementation(endpoint, {
        headers: {
          Accept: 'application/json',
          'User-Agent': config.nominatimUserAgent,
        },
        signal: controller.signal,
      })
      if (!response.ok) {
        const error = new Error(`Nominatim responded with HTTP ${response.status}`)
        error.statusCode = response.status
        throw error
      }
      const payload = await response.json()
      const places = (Array.isArray(payload) ? payload : [])
        .map(serializePlace)
        .filter(Boolean)
      const value = {
        places,
        attribution: ATTRIBUTION,
        cached: false,
      }
      setCached(key, value)
      return value
    } finally {
      clearTimeout(timeout)
    }
  })
}

export const setNominatimFetchForTests = (implementation) => {
  fetchImplementation = implementation || fetch
  cache.clear()
  requestQueue = Promise.resolve()
  lastRequestStartedAt = 0
  pendingRequests = 0
}

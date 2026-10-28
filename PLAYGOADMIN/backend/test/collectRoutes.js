import fs from 'node:fs'
import path from 'node:path'

const backendRoot = path.resolve(import.meta.dirname, '..')
const srcRoot = path.join(backendRoot, 'src')

const joinPath = (prefix, routePath) => {
  if (!routePath || routePath === '/') return prefix || '/'
  const left = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  const right = routePath.startsWith('/') ? routePath : `/${routePath}`
  return `${left}${right}`.replace(/\/+/g, '/')
}

const read = (file) => fs.readFileSync(file, 'utf8')

export const collectRoutes = () => {
  const appSource = read(path.join(srcRoot, 'app.js'))
  const imports = new Map()
  for (const match of appSource.matchAll(
    /import\s+(\w+)\s+from\s+'\.\/routes\/([^']+)'/g,
  )) {
    imports.set(match[1], path.join(srcRoot, 'routes', match[2]))
  }

  const mounts = []
  for (const match of appSource.matchAll(
    /app\.use\(\s*'([^']+)'\s*,\s*([A-Za-z0-9_]+)/g,
  )) {
    const file = imports.get(match[2])
    if (file) mounts.push({ prefix: match[1], file })
  }

  const routes = []
  for (const match of appSource.matchAll(
    /app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g,
  )) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      source: 'src/app.js',
    })
  }

  const visit = (file, prefix) => {
    const source = read(file)
    for (const match of source.matchAll(
      /router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g,
    )) {
      routes.push({
        method: match[1].toUpperCase(),
        path: joinPath(prefix, match[2]),
        source: path.relative(backendRoot, file),
      })
    }
    for (const match of source.matchAll(
      /import\s+(\w+)\s+from\s+'\.\/([^']+)'/g,
    )) {
      imports.set(`${file}:${match[1]}`, path.join(path.dirname(file), match[2]))
    }
    for (const match of source.matchAll(
      /router\.use\(\s*'([^']+)'\s*,\s*([A-Za-z0-9_]+)/g,
    )) {
      const nested = imports.get(`${file}:${match[2]}`)
      if (!nested) {
        throw new Error(`Не найден вложенный роутер ${match[2]} в ${file}`)
      }
      visit(nested, joinPath(prefix, match[1]))
    }
  }

  for (const mount of mounts) visit(mount.file, mount.prefix)

  routes.sort((a, b) =>
    a.path === b.path
      ? a.method.localeCompare(b.method)
      : a.path.localeCompare(b.path),
  )

  const seen = new Set()
  for (const route of routes) {
    const key = `${route.method} ${route.path}`
    if (seen.has(key)) throw new Error(`Дублирующийся маршрут ${key}`)
    seen.add(key)
  }
  return routes
}

const OPTIONAL = new Set([
  'GET /api/players',
  'GET /api/players/:userId',
  'GET /api/wellness-stories',
  'GET /api/wellness-stories/:identifier',
  'GET /api/workout-programs',
  'GET /api/workout-programs/:id',
  'GET /api/workout-programs/:id/steps',
])

const BEARER_EXACT = new Set([
  'GET /api/ecosystem',
  'POST /api/subscriptions',
  'GET /api/users/search',
])

export const classifyAuth = (method, routePath) => {
  const key = `${method} ${routePath}`
  if (routePath.startsWith('/api/admin')) return 'basic'
  if (OPTIONAL.has(key)) return 'optional'
  if (routePath === '/api/me' || routePath.startsWith('/api/me/')) return 'bearer'
  if (BEARER_EXACT.has(key)) return 'bearer'
  return 'none'
}

export const classifyDomain = (routePath) => {
  if (
    routePath === '/api/health' ||
    routePath === '/api/openapi.json' ||
    routePath.startsWith('/api/admin/uploads')
  ) {
    return 'platform'
  }
  if (routePath.includes('/ai-matches')) return 'ai-matches'
  if (
    routePath.startsWith('/api/auth') ||
    routePath === '/api/me' ||
    routePath.startsWith('/api/me/avatar') ||
    routePath.startsWith('/api/me/password')
  ) {
    return 'auth'
  }
  if (routePath.startsWith('/api/me/privacy')) return 'privacy'
  if (routePath.startsWith('/api/admin/users')) return 'users'
  if (routePath.includes('wellness')) return 'wellness'
  if (routePath.includes('workout')) return 'workouts'
  if (routePath.includes('news')) return 'news'
  if (
    routePath.includes('/chats') ||
    routePath.includes('/friends') ||
    routePath === '/api/users/search'
  ) {
    return 'social'
  }
  if (routePath.includes('support')) return 'support'
  if (routePath.includes('/crm') || routePath.endsWith('/overview')) return 'crm'
  if (routePath.includes('booking')) return 'bookings'
  if (
    routePath.includes('order') ||
    routePath.includes('subscription') ||
    routePath.includes('premium') ||
    routePath.includes('referral') ||
    routePath.includes('yookassa')
  ) {
    return 'commerce'
  }
  if (routePath.includes('notification') || routePath.includes('push')) {
    return 'notifications'
  }
  if (routePath.includes('coach')) return 'coaches'
  if (
    routePath.includes('club') ||
    routePath.includes('/sports') ||
    routePath.includes('/search/places')
  ) {
    return 'clubs'
  }
  if (routePath.includes('player') || routePath.includes('/players')) {
    return 'player-cards'
  }
  if (routePath.includes('team')) return 'teams'
  if (
    routePath.includes('cities') ||
    routePath.includes('stadium') ||
    routePath.includes('match') ||
    routePath.includes('registration')
  ) {
    return 'football'
  }
  if (routePath === '/api/ecosystem') return 'ecosystem'
  return 'unclassified'
}

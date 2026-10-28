import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import request from 'supertest'

import {
  classifyAuth,
  classifyDomain,
  collectRoutes,
} from './collectRoutes.js'

const repoRoot = path.resolve(import.meta.dirname, '../../..')
const contractPath = path.join(
  repoRoot,
  'openspec/contracts/eventum-api.contract.json',
)
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))

process.env.NODE_ENV = 'test'
const { default: app } = await import('../src/app.js')

const keyOf = (route) => `${route.method} ${route.path}`

test('контракт eventum-api совпадает с маршрутами Express', () => {
  assert.equal(contract.name, 'eventum-api')
  assert.equal(contract.version, '1.0.0')
  assert.deepEqual(contract.products, ['FOOTBALL', 'CLUBS'])
  assert.equal(contract.productHeader, 'X-Eventum-Product')
  assert.equal(contract.productFallback, 'FOOTBALL')

  const fromCode = collectRoutes()
  const fromContract = contract.endpoints
  assert.equal(fromContract.length, fromCode.length)

  const codeKeys = fromCode.map(keyOf)
  const contractKeys = fromContract.map(keyOf)
  assert.deepEqual(contractKeys, codeKeys)

  for (const endpoint of fromContract) {
    assert.equal(endpoint.auth, classifyAuth(endpoint.method, endpoint.path))
    assert.equal(endpoint.domain, classifyDomain(endpoint.path))
    assert.notEqual(endpoint.domain, 'unclassified')
    const specFile = path.join(
      repoRoot,
      'openspec/specs',
      endpoint.domain,
      'spec.md',
    )
    assert.equal(
      fs.existsSync(specFile),
      true,
      `нет спеки домена ${endpoint.domain}`,
    )
  }
})

test('в контракте описаны Swagger и websocket чатов', () => {
  assert.deepEqual(contract.documentation, [
    {
      method: 'GET',
      path: '/api/docs',
      auth: 'none',
      domain: 'platform',
      note: 'Swagger UI. Не Express-route с собственным handler.',
    },
  ])
  assert.equal(contract.realtime[0].path, '/api/ws/chats')
  assert.equal(contract.realtime[0].protocol, 'websocket')
  assert.equal(contract.realtime[0].auth, 'bearer')

  const appSource = fs.readFileSync(
    path.join(repoRoot, 'PLAYGOADMIN/backend/src/app.js'),
    'utf8',
  )
  const realtimeSource = fs.readFileSync(
    path.join(repoRoot, 'PLAYGOADMIN/backend/src/lib/chatRealtime.js'),
    'utf8',
  )
  assert.match(appSource, /\/api\/docs/)
  assert.match(realtimeSource, /\/api\/ws\/chats/)
})

test('OpenAPI JSON и админский Basic Auth соответствуют контракту', async () => {
  const openapi = await request(app).get('/api/openapi.json')
  assert.equal(openapi.status, 200)
  assert.equal(openapi.body.openapi, '3.0.3')
  assert.equal(openapi.body.info.title, 'EVENTUM API')

  const admin = await request(app).get('/api/admin/cities')
  assert.equal(admin.status, 401)
  assert.match(admin.headers['www-authenticate'], /^Basic /)
  assert.equal(admin.body.error, 'Auth required')
})

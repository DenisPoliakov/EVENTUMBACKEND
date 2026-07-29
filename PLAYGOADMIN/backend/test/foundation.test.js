import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import request from 'supertest'

process.env.NODE_ENV = 'test'
const { default: app } = await import('../src/app.js')

test('app exports an Express handler and returns JSON 404s', async () => {
  assert.equal(typeof app, 'function')
  const response = await request(app).get('/does-not-exist')
  assert.equal(response.status, 404)
  assert.deepEqual(response.body, { error: 'Not found' })
  assert.equal(response.headers['x-powered-by'], undefined)
})

test('admin routes require basic authentication', async () => {
  const response = await request(app).get('/api/admin/cities')
  assert.equal(response.status, 401)
  assert.match(response.headers['www-authenticate'], /^Basic /)
})

test('oversized JSON payloads are rejected', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'user@example.com', password: 'x'.repeat(300 * 1024) })
  assert.equal(response.status, 413)
})

test('production configuration rejects missing secrets and CORS origins', () => {
  const env = { ...process.env, NODE_ENV: 'production' }
  delete env.JWT_SECRET
  delete env.ADMIN_USER
  delete env.ADMIN_PASSWORD
  delete env.CORS_ORIGINS

  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', "import('./src/config.js')"],
    { cwd: process.cwd(), env, encoding: 'utf8' },
  )

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /JWT_SECRET is required/)
})

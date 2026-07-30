import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

import request from 'supertest'
import WebSocket from 'ws'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

const waitForMessage = (ws, predicate, timeoutMs = 3000) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off('message', onMessage)
      reject(new Error('Timed out waiting for websocket message'))
    }, timeoutMs)
    const onMessage = (raw) => {
      const payload = JSON.parse(String(raw))
      if (!predicate(payload)) return
      clearTimeout(timeout)
      ws.off('message', onMessage)
      resolve(payload)
    }
    ws.on('message', onMessage)
  })

test(
  'notifications are delivered and synchronized through websocket',
  { skip: testDatabaseUrl ? false : skipWithoutDatabase },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = testDatabaseUrl
    const [
      { default: app },
      { default: prisma },
      { hashPassword, signToken },
      push,
      { attachChatRealtime },
    ] = await Promise.all([
      import('../src/app.js'),
      import('../src/prisma.js'),
      import('../src/lib/auth.js'),
      import('../src/lib/pushNotifications.js'),
      import('../src/lib/chatRealtime.js'),
    ])

    push.setPushSchedulerForTests(() => {})
    const marker = `notification-realtime-${Date.now()}`
    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.com`,
        username: marker,
        name: marker,
        passwordHash: hashPassword('password123'),
      },
    })
    const blockedUser = await prisma.user.create({
      data: {
        email: `blocked-${marker}@example.com`,
        username: `blocked-${marker}`,
        name: `blocked-${marker}`,
        passwordHash: hashPassword('password123'),
        isBlocked: true,
      },
    })
    const token = signToken({
      sub: user.id,
      email: user.email,
      username: user.username,
    })
    const auth = { Authorization: `Bearer ${token}` }
    const server = http.createServer(app)
    const realtime = attachChatRealtime(server)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const ws = new WebSocket(
      `ws://127.0.0.1:${server.address().port}/api/ws/chats?token=${token}`,
    )
    const received = []
    ws.on('message', (raw) => {
      received.push(JSON.parse(String(raw)))
    })
    const waitFor = (predicate) => {
      const existing = received.find(predicate)
      return existing ? Promise.resolve(existing) : waitForMessage(ws, predicate)
    }

    try {
      await new Promise((resolve, reject) => {
        ws.once('open', resolve)
        ws.once('error', reject)
      })
      const initialSync = await waitFor((payload) => payload.type === 'notifications:sync')
      assert.equal(initialSync.unreadCount, 0)

      const createdEventPromise = waitFor((payload) => payload.type === 'notification:upserted')
      const [{ notification }, createdEvent] = await Promise.all([
        push.createNotificationWithPush({
          userId: user.id,
          type: 'MANUAL_CAMPAIGN',
          title: 'Realtime title',
          body: 'Realtime body',
          dedupeKey: `${marker}:first`,
          queue: false,
        }),
        createdEventPromise,
      ])
      assert.equal(createdEvent.notification.id, notification.id)
      assert.equal(createdEvent.notification.title, 'Realtime title')
      assert.equal(createdEvent.unreadCount, 1)

      const updatedEventPromise = waitFor((payload) => payload.type === 'notification:updated')
      const [readResponse, updatedEvent] = await Promise.all([
        request(app)
          .patch(`/api/me/notifications/${notification.id}/read`)
          .set(auth)
          .send({ isRead: true }),
        updatedEventPromise,
      ])
      assert.equal(readResponse.status, 200)
      assert.equal(updatedEvent.notification.id, notification.id)
      assert.equal(updatedEvent.notification.isRead, true)
      assert.equal(updatedEvent.unreadCount, 0)

      await push.createNotificationWithPush({
        userId: user.id,
        type: 'MANUAL_CAMPAIGN',
        title: 'Second title',
        body: 'Second body',
        dedupeKey: `${marker}:second`,
        queue: false,
      })
      const readAllEventPromise = waitFor(
        (payload) => payload.type === 'notifications:read-all',
      )
      const [readAllResponse, readAllEvent] = await Promise.all([
        request(app).post('/api/me/notifications/read-all').set(auth),
        readAllEventPromise,
      ])
      assert.equal(readAllResponse.status, 200)
      assert.equal(readAllEvent.unreadCount, 0)

      const blockedToken = signToken({
        sub: blockedUser.id,
        email: blockedUser.email,
        username: blockedUser.username,
      })
      const blockedSocket = new WebSocket(
        `ws://127.0.0.1:${server.address().port}/api/ws/chats?token=${blockedToken}`,
      )
      const blockedStatus = await new Promise((resolve, reject) => {
        blockedSocket.once('unexpected-response', (_req, response) => {
          response.resume()
          resolve(response.statusCode)
        })
        blockedSocket.once('open', () => reject(new Error('Blocked user websocket opened')))
        blockedSocket.once('error', () => {})
      })
      assert.equal(blockedStatus, 403)
    } finally {
      push.setPushSchedulerForTests(null)
      ws.terminate()
      realtime.close()
      await new Promise((resolve) => server.close(resolve))
      await prisma.user.deleteMany({
        where: { id: { in: [user.id, blockedUser.id] } },
      })
      await prisma.$disconnect()
    }
  },
)

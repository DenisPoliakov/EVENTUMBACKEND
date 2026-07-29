import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import request from 'supertest'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

test(
  'workout session sync and concurrent news analytics',
  { skip: testDatabaseUrl ? false : skipWithoutDatabase },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = testDatabaseUrl
    const [{ default: app }, { default: prisma }, { hashPassword, signToken }] =
      await Promise.all([
        import('../src/app.js'),
        import('../src/prisma.js'),
        import('../src/lib/auth.js'),
      ])

    const marker = `sessions-news-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
    const credentials = [
      process.env.ADMIN_USER || 'admin',
      process.env.ADMIN_PASSWORD || 'admin',
    ]
    const admin = {
      get: (url) => request(app).get(url).auth(...credentials),
      post: (url) => request(app).post(url).auth(...credentials),
      delete: (url) => request(app).delete(url).auth(...credentials),
    }
    const userIds = []
    let newsId
    let uploadedPath

    try {
      await prisma.workoutProgram.create({
        data: {
          id: marker,
          title: 'Session test program',
          description: 'Program used by workout session integration tests',
        },
      })

      const tokens = []
      for (let index = 0; index < 2; index += 1) {
        const user = await prisma.user.create({
          data: {
            email: `${marker}-${index}@example.com`,
            username: `${marker}-${index}`,
            name: `Test user ${index}`,
            passwordHash: hashPassword('test-password'),
          },
        })
        userIds.push(user.id)
        tokens.push(
          signToken({
            sub: user.id,
            email: user.email,
            username: user.username,
          })
        )
      }

      const finishedAt = new Date(Date.now() - 60_000).toISOString()
      const sessionPayload = {
        programId: marker,
        startedAt: new Date(Date.now() - 1_560_000).toISOString(),
        finishedAt,
        durationSeconds: 1500,
        source: 'timer',
        customPlan: { rounds: 3 },
        clientKey: `${marker}-client-key`,
      }
      const createdSession = await request(app)
        .post('/api/me/workout-sessions')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send(sessionPayload)
      assert.equal(createdSession.status, 201)
      assert.equal(createdSession.body.source, 'timer')
      assert.deepEqual(createdSession.body.customPlan, { rounds: 3 })

      const serverWins = await request(app)
        .post('/api/me/workout-sessions')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({ ...sessionPayload, durationSeconds: 42 })
      assert.equal(serverWins.status, 200)
      assert.equal(serverWins.body.id, createdSession.body.id)
      assert.equal(serverWins.body.durationSeconds, 1500)

      const legacyPayload = {
        programId: marker,
        finishedAt: new Date(Date.now() - 30_000).toISOString(),
        durationSeconds: 1800,
        source: 'manual',
        customPlan: null,
      }
      const firstBulk = await request(app)
        .post('/api/me/workout-sessions/bulk')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({ sessions: [legacyPayload] })
      const repeatedBulk = await request(app)
        .post('/api/me/workout-sessions/bulk')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({ sessions: [legacyPayload] })
      assert.equal(firstBulk.status, 200)
      assert.equal(firstBulk.body.createdCount, 1)
      assert.equal(repeatedBulk.body.existingCount, 1)
      assert.equal(
        repeatedBulk.body.sessions[0].id,
        firstBulk.body.sessions[0].id
      )

      const listedSessions = await request(app)
        .get(
          `/api/me/workout-sessions?from=${encodeURIComponent(
            new Date(Date.now() - 3_600_000).toISOString()
          )}&limit=10`
        )
        .set('Authorization', `Bearer ${tokens[0]}`)
      assert.equal(listedSessions.status, 200)
      assert.equal(listedSessions.body.sessions.length, 2)

      const oversizedBulk = await request(app)
        .post('/api/me/workout-sessions/bulk')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({ sessions: Array.from({ length: 501 }, () => legacyPayload) })
      assert.equal(oversizedBulk.status, 400)

      const createdNews = await admin.post('/api/admin/news').send({
        title: 'Sponsored integration test',
        body: 'News analytics test body',
        type: 'sponsored',
      })
      assert.equal(createdNews.status, 201)
      assert.equal(createdNews.body.type, 'sponsored')
      assert.equal(createdNews.body.viewCount, 0)
      newsId = createdNews.body.id

      const invalidImage = await admin
        .post(`/api/admin/news/${newsId}/image`)
        .attach('file', Buffer.from('not an image'), {
          filename: 'news.txt',
          contentType: 'text/plain',
        })
      assert.equal(invalidImage.status, 400)

      const uploadedImage = await admin
        .post(`/api/admin/news/${newsId}/image`)
        .attach('file', Buffer.from('test image'), {
          filename: 'news.webp',
          contentType: 'image/webp',
        })
      assert.equal(uploadedImage.status, 201)
      uploadedPath = path.join(
        process.cwd(),
        'public',
        uploadedImage.body.url.replace(/^\//, '')
      )
      assert.equal(fs.existsSync(uploadedPath), true)

      const concurrentViews = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(app)
            .post(`/api/me/news/${newsId}/view`)
            .set('Authorization', `Bearer ${tokens[0]}`)
        )
      )
      assert.equal(
        concurrentViews.filter((response) => response.status === 200).length,
        10
      )
      assert.equal(
        concurrentViews.filter(
          (response) => response.body.isFirstViewByUser === true
        ).length,
        1
      )

      const secondUserView = await request(app)
        .post(`/api/me/news/${newsId}/view`)
        .set('Authorization', `Bearer ${tokens[1]}`)
      assert.equal(secondUserView.body.viewCount, 11)
      assert.equal(secondUserView.body.uniqueViewerCount, 2)

      const adminFeed = await admin.get('/api/admin/news')
      const adminItem = adminFeed.body.find((item) => item.id === newsId)
      assert.equal(adminItem.viewCount, 11)
      assert.equal(adminItem.uniqueViewerCount, 2)

      const personalFeed = await request(app)
        .get('/api/me/news')
        .set('Authorization', `Bearer ${tokens[0]}`)
      const personalItem = personalFeed.body.news.find(
        (item) => item.id === newsId
      )
      assert.equal(personalItem.type, 'sponsored')
      assert.equal(personalItem.viewCount, 11)

      await prisma.user.delete({ where: { id: userIds.pop() } })
      const afterGdprDelete = await admin.get('/api/admin/news')
      const afterDeleteItem = afterGdprDelete.body.find(
        (item) => item.id === newsId
      )
      assert.equal(afterDeleteItem.viewCount, 10)
      assert.equal(afterDeleteItem.uniqueViewerCount, 1)

      const removedNews = await admin.delete(`/api/admin/news/${newsId}`)
      assert.equal(removedNews.status, 204)
      newsId = undefined
      assert.equal(fs.existsSync(uploadedPath), false)
      uploadedPath = undefined
    } finally {
      if (newsId) await prisma.news.deleteMany({ where: { id: newsId } })
      if (userIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } })
      }
      await prisma.workoutProgram.deleteMany({ where: { id: marker } })
      if (uploadedPath) fs.rmSync(uploadedPath, { force: true })
      await prisma.$disconnect()
    }
  }
)

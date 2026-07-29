import assert from 'node:assert/strict'
import test from 'node:test'

import request from 'supertest'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

test(
  'wellness public filters, views, admin CRUD/import, and uploads',
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

    const marker = `wellness-test-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
    const adminCredentials = [
      process.env.ADMIN_USER || 'admin',
      process.env.ADMIN_PASSWORD || 'admin',
    ]
    const admin = {
      get: (path) => request(app).get(path).auth(...adminCredentials),
      post: (path) => request(app).post(path).auth(...adminCredentials),
      put: (path) => request(app).put(path).auth(...adminCredentials),
      delete: (path) => request(app).delete(path).auth(...adminCredentials),
    }
    const storyIds = []
    let userId

    try {
      const health = await request(app).get('/api/health')
      assert.equal(health.status, 200)
      assert.equal(health.body.database, 'up')

      const created = await admin.post('/api/admin/wellness-stories').send({
        slug: `${marker}-visible`,
        title: 'Visible story',
        body: 'Visible body',
        category: 'routine',
        readMinutes: 4,
        sortOrder: -9999,
        locale: 'ru',
        isActive: true,
        publishedAt: new Date(Date.now() - 60_000).toISOString(),
      })
      assert.equal(created.status, 201)
      assert.equal(created.body.slug, `${marker}-visible`)
      storyIds.push(created.body.id)
      const adminDetail = await admin.get(
        `/api/admin/wellness-stories/${created.body.id}`
      )
      assert.equal(adminDetail.status, 200)
      assert.equal(adminDetail.body.id, created.body.id)

      for (const [suffix, overrides] of [
        ['inactive', { isActive: false }],
        ['future', { publishedAt: new Date(Date.now() + 86_400_000) }],
      ]) {
        const story = await prisma.wellnessStory.create({
          data: {
            slug: `${marker}-${suffix}`,
            title: `${suffix} story`,
            body: `${suffix} body`,
            category: 'ROUTINE',
            ...overrides,
          },
        })
        storyIds.push(story.id)
      }
      const deleted = await prisma.wellnessStory.create({
        data: {
          slug: `${marker}-deleted`,
          title: 'Deleted story',
          body: 'Deleted body',
          category: 'ROUTINE',
          deletedAt: new Date(),
        },
      })
      storyIds.push(deleted.id)

      const feed = await request(app).get(
        '/api/wellness-stories?locale=ru&limit=100'
      )
      assert.equal(feed.status, 200)
      const markerStories = feed.body.stories.filter((story) =>
        story.slug?.startsWith(marker)
      )
      assert.deepEqual(
        markerStories.map((story) => story.slug),
        [`${marker}-visible`]
      )

      const detailBySlug = await request(app).get(
        `/api/wellness-stories/${marker}-visible`
      )
      assert.equal(detailBySlug.status, 200)
      assert.equal(detailBySlug.body.id, created.body.id)
      const detailById = await request(app).get(
        `/api/wellness-stories/${created.body.id}`
      )
      assert.equal(detailById.status, 200)
      assert.equal(detailById.body.slug, `${marker}-visible`)

      const user = await prisma.user.create({
        data: {
          email: `${marker}@example.com`,
          username: marker,
          name: 'Wellness Test',
          passwordHash: hashPassword('test-password'),
        },
      })
      userId = user.id
      const token = signToken({
        sub: user.id,
        email: user.email,
        username: user.username,
      })
      const firstView = await request(app)
        .post(`/api/me/wellness-stories/${marker}-visible/view`)
        .set('Authorization', `Bearer ${token}`)
      const repeatedView = await request(app)
        .post(`/api/me/wellness-stories/${created.body.id}/view`)
        .set('Authorization', `Bearer ${token}`)
      assert.equal(firstView.status, 200)
      assert.equal(firstView.body.isFirstViewByUser, true)
      assert.equal(repeatedView.status, 200)
      assert.equal(repeatedView.body.isFirstViewByUser, false)
      assert.equal(
        repeatedView.body.uniqueViewerCount,
        firstView.body.uniqueViewerCount
      )

      const updated = await admin
        .put(`/api/admin/wellness-stories/${created.body.id}`)
        .send({ title: 'Updated visible story' })
      assert.equal(updated.status, 200)
      assert.equal(updated.body.title, 'Updated visible story')

      const importPayload = {
        stories: [
          {
            slug: `${marker}-imported`,
            title: 'Imported story',
            body: 'Explicit imported body',
            category: 'nutrition',
            readMinutes: 5,
            sortOrder: 12,
            isActive: true,
          },
        ],
      }
      const imported = await admin
        .post('/api/admin/wellness-stories/import')
        .send(importPayload)
      assert.equal(imported.status, 200)
      assert.equal(imported.body.created, 1)
      assert.equal(imported.body.updated, 0)
      storyIds.push(imported.body.stories[0].id)

      importPayload.stories[0].title = 'Imported story updated'
      const reimported = await admin
        .post('/api/admin/wellness-stories/import')
        .send(importPayload)
      assert.equal(reimported.status, 200)
      assert.equal(reimported.body.created, 0)
      assert.equal(reimported.body.updated, 1)
      assert.equal(reimported.body.stories[0].id, imported.body.stories[0].id)
      assert.equal(
        reimported.body.stories[0].title,
        'Imported story updated'
      )

      const rejectedSlug = `${marker}-must-not-exist`
      const invalidImport = await admin
        .post('/api/admin/wellness-stories/import')
        .send({
          stories: [
            { ...importPayload.stories[0], slug: rejectedSlug },
            {
              slug: `${marker}-invalid`,
              title: '',
              body: 'Invalid',
              category: 'routine',
            },
          ],
        })
      assert.equal(invalidImport.status, 400)
      assert.equal(
        await prisma.wellnessStory.count({ where: { slug: rejectedSlug } }),
        0
      )

      const invalidUpload = await admin
        .post(`/api/admin/wellness-stories/${created.body.id}/cover`)
        .attach('file', Buffer.from('not an image'), {
          filename: 'cover.txt',
          contentType: 'text/plain',
        })
      assert.equal(invalidUpload.status, 400)
      assert.match(invalidUpload.body.error, /Only JPEG/)

      const removed = await admin.delete(
        `/api/admin/wellness-stories/${created.body.id}`
      )
      assert.equal(removed.status, 204)
      const hiddenDetail = await request(app).get(
        `/api/wellness-stories/${marker}-visible`
      )
      assert.equal(hiddenDetail.status, 404)
    } finally {
      await prisma.wellnessStory.deleteMany({
        where: { id: { in: storyIds } },
      })
      if (userId) await prisma.user.deleteMany({ where: { id: userId } })
      await prisma.$disconnect()
    }
  },
)

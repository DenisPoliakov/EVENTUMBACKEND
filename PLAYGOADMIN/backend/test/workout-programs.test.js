import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import request from 'supertest'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

test(
  'workout programs public API, views, admin steps, reorder, and uploads',
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

    const marker = `workout-test-${Date.now()}-${Math.random()
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
    let userId

    try {
      const created = await admin.post('/api/admin/workout-programs').send({
        id: marker,
        title: 'Тестовая программа',
        subtitle: 'Явно заданный тестовый контент',
        description: 'Описание тестовой программы',
        gradientStart: '#E8F5EC',
        gradientEnd: '#86EFAC',
        estimatedMinutes: 10,
        sortOrder: -9999,
        isActive: true,
        locale: 'ru',
      })
      assert.equal(created.status, 201)
      assert.equal(created.body.id, marker)
      assert.equal(created.body.stepCount, 0)

      const firstStep = await admin
        .post(`/api/admin/workout-programs/${marker}/steps`)
        .send({
          phase: 'warmup',
          title: 'Тестовая разминка',
          durationSeconds: 120,
          poseIndex: 0,
        })
      assert.equal(firstStep.status, 201)
      assert.equal(firstStep.body.order, 1)

      const secondStep = await admin
        .post(`/api/admin/workout-programs/${marker}/steps`)
        .send({
          phase: 'work',
          title: 'Тестовый рабочий шаг',
          durationSeconds: 90,
        })
      assert.equal(secondStep.status, 201)
      assert.equal(secondStep.body.order, 2)

      const reordered = await admin
        .put(`/api/admin/workout-programs/${marker}/steps/reorder`)
        .send({ stepIds: [secondStep.body.id, firstStep.body.id] })
      assert.equal(reordered.status, 200)
      assert.deepEqual(
        reordered.body.steps.map((step) => step.id),
        [secondStep.body.id, firstStep.body.id]
      )

      const incompleteReorder = await admin
        .put(`/api/admin/workout-programs/${marker}/steps/reorder`)
        .send({ stepIds: [firstStep.body.id] })
      assert.equal(incompleteReorder.status, 400)

      const invalidUpload = await admin
        .post(
          `/api/admin/workout-programs/${marker}/steps/${firstStep.body.id}/illustration`
        )
        .attach('file', Buffer.from('not an image'), {
          filename: 'illustration.txt',
          contentType: 'text/plain',
        })
      assert.equal(invalidUpload.status, 400)
      assert.match(invalidUpload.body.error, /Only JPEG/)

      const oversizedUpload = await admin
        .post(
          `/api/admin/workout-programs/${marker}/steps/${firstStep.body.id}/illustration`
        )
        .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), {
          filename: 'illustration.png',
          contentType: 'image/png',
        })
      assert.equal(oversizedUpload.status, 400)
      assert.match(oversizedUpload.body.error, /5 MB/)

      const firstUpload = await admin
        .post(
          `/api/admin/workout-programs/${marker}/steps/${firstStep.body.id}/illustration`
        )
        .attach('file', Buffer.from('first test image'), {
          filename: 'illustration.png',
          contentType: 'image/png',
        })
      assert.equal(firstUpload.status, 201)
      const firstUploadPath = path.join(
        process.cwd(),
        'public',
        firstUpload.body.url.replace(/^\//, '')
      )
      assert.equal(fs.existsSync(firstUploadPath), true)

      const replacementUpload = await admin
        .post(
          `/api/admin/workout-programs/${marker}/steps/${firstStep.body.id}/illustration`
        )
        .attach('file', Buffer.from('replacement test image'), {
          filename: 'illustration.webp',
          contentType: 'image/webp',
        })
      assert.equal(replacementUpload.status, 201)
      const replacementUploadPath = path.join(
        process.cwd(),
        'public',
        replacementUpload.body.url.replace(/^\//, '')
      )
      assert.equal(fs.existsSync(firstUploadPath), false)
      assert.equal(fs.existsSync(replacementUploadPath), true)

      const publicList = await request(app).get(
        '/api/workout-programs?locale=ru'
      )
      assert.equal(publicList.status, 200)
      const listed = publicList.body.programs.find(
        (program) => program.id === marker
      )
      assert.equal(listed.stepCount, 2)
      assert.equal(listed.totalDurationSeconds, 210)
      assert.equal(listed.viewedByMe, false)

      const publicDetail = await request(app).get(
        `/api/workout-programs/${marker}`
      )
      assert.equal(publicDetail.status, 200)
      assert.equal(publicDetail.body.id, marker)
      assert.equal(publicDetail.body.totalDurationSeconds, 210)

      const publicSteps = await request(app).get(
        `/api/workout-programs/${marker}/steps`
      )
      assert.equal(publicSteps.status, 200)
      assert.deepEqual(
        publicSteps.body.steps.map((step) => step.id),
        [secondStep.body.id, firstStep.body.id]
      )

      const user = await prisma.user.create({
        data: {
          email: `${marker}@example.com`,
          username: marker,
          name: 'Workout Test',
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
        .post(`/api/me/workout-programs/${marker}/view`)
        .set('Authorization', `Bearer ${token}`)
      const repeatedView = await request(app)
        .post(`/api/me/workout-programs/${marker}/view`)
        .set('Authorization', `Bearer ${token}`)
      assert.equal(firstView.status, 200)
      assert.equal(firstView.body.isFirstViewByUser, true)
      assert.equal(repeatedView.body.isFirstViewByUser, false)
      assert.equal(repeatedView.body.uniqueViewerCount, 1)

      const authenticatedList = await request(app)
        .get('/api/workout-programs')
        .set('Authorization', `Bearer ${token}`)
      assert.equal(
        authenticatedList.body.programs.find(
          (program) => program.id === marker
        ).viewedByMe,
        true
      )

      const updated = await admin
        .put(`/api/admin/workout-programs/${marker}`)
        .send({ id: marker, title: 'Обновлённая тестовая программа' })
      assert.equal(updated.status, 200)
      assert.equal(updated.body.title, 'Обновлённая тестовая программа')

      const removed = await admin.delete(
        `/api/admin/workout-programs/${marker}`
      )
      assert.equal(removed.status, 204)
      assert.equal(fs.existsSync(replacementUploadPath), false)
      assert.equal(
        (await request(app).get(`/api/workout-programs/${marker}`)).status,
        404
      )
    } finally {
      await prisma.workoutProgram.deleteMany({ where: { id: marker } })
      if (userId) await prisma.user.deleteMany({ where: { id: userId } })
      fs.rmSync(
        path.join(process.cwd(), 'public', 'uploads', 'workouts', marker),
        { recursive: true, force: true }
      )
      await prisma.$disconnect()
    }
  }
)

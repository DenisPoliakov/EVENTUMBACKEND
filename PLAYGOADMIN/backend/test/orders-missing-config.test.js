import assert from 'node:assert/strict'
import test from 'node:test'

import request from 'supertest'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

test(
  'missing YooKassa configuration keeps one pending order and creates no subscription',
  { skip: testDatabaseUrl ? false : skipWithoutDatabase },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = testDatabaseUrl
    delete process.env.YOOKASSA_SHOP_ID
    delete process.env.YOOKASSA_SECRET_KEY
    const [{ default: app }, { default: prisma }, { hashPassword, signToken }] =
      await Promise.all([
        import('../src/app.js'),
        import('../src/prisma.js'),
        import('../src/lib/auth.js'),
      ])
    const marker = `orders-missing-${Date.now()}-${Math.random().toString(16).slice(2)}`
    let sport
    let plan
    let user
    try {
      sport = await prisma.sport.create({
        data: { code: marker.toUpperCase().replace(/-/g, '_'), name: marker },
      })
      plan = await prisma.membershipPlan.create({
        data: {
          sportId: sport.id,
          title: marker,
          priceCents: 5000,
          durationDays: 7,
        },
      })
      user = await prisma.user.create({
        data: {
          email: `${marker}@example.com`,
          name: marker,
          passwordHash: hashPassword('password123'),
        },
      })
      const token = signToken({ sub: user.id, email: user.email, username: '' })
      const send = () =>
        request(app)
          .post('/api/me/orders')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', marker)
          .send({ planId: plan.id })
      const first = await send()
      const replay = await send()
      assert.equal(first.status, 503)
      assert.equal(first.body.code, 'PAYMENTS_NOT_CONFIGURED')
      assert.equal(first.body.order.status, 'PENDING')
      assert.equal(replay.status, 503)
      assert.equal(replay.body.order.id, first.body.order.id)
      assert.equal(await prisma.order.count({ where: { userId: user.id } }), 1)
      assert.equal(await prisma.userSubscription.count({ where: { userId: user.id } }), 0)
    } finally {
      if (user) {
        await prisma.payment.deleteMany({ where: { order: { userId: user.id } } })
        await prisma.order.deleteMany({ where: { userId: user.id } })
        await prisma.user.deleteMany({ where: { id: user.id } })
      }
      if (plan) await prisma.membershipPlan.deleteMany({ where: { id: plan.id } })
      if (sport) await prisma.sport.deleteMany({ where: { id: sport.id } })
      await prisma.$disconnect()
    }
  },
)

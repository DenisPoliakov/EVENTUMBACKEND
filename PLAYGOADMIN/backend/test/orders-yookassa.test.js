import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

import request from 'supertest'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

test(
  'orders are server-priced, idempotent, and webhook activation is verified and replay-safe',
  { skip: testDatabaseUrl ? false : skipWithoutDatabase },
  async () => {
    let providerPayment
    let createCalls = 0
    const provider = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json')
      if (req.method === 'POST' && req.url === '/v3/payments') {
        createCalls += 1
        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', () => {
          const body = JSON.parse(raw)
          providerPayment = {
            id: 'yk-test-payment',
            status: 'pending',
            paid: false,
            amount: body.amount,
            metadata: body.metadata,
            confirmation: { confirmation_url: 'https://yookassa.test/confirm' },
          }
          res.end(JSON.stringify(providerPayment))
        })
        return
      }
      if (req.method === 'GET' && req.url === '/v3/payments/yk-test-payment') {
        res.end(JSON.stringify(providerPayment))
        return
      }
      res.statusCode = 404
      res.end('{}')
    })
    await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve))

    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = testDatabaseUrl
    process.env.YOOKASSA_SHOP_ID = 'shop'
    process.env.YOOKASSA_SECRET_KEY = 'secret'
    process.env.YOOKASSA_API_URL = `http://127.0.0.1:${provider.address().port}/v3`
    const [{ default: app }, { default: prisma }, { hashPassword, signToken }] =
      await Promise.all([
        import('../src/app.js'),
        import('../src/prisma.js'),
        import('../src/lib/auth.js'),
      ])
    const marker = `orders-${Date.now()}-${Math.random().toString(16).slice(2)}`
    let sport
    let club
    let plan
    let user

    try {
      sport = await prisma.sport.create({
        data: { code: marker.toUpperCase().replace(/-/g, '_'), name: marker },
      })
      club = await prisma.sportClub.create({
        data: { sportId: sport.id, name: marker, address: 'Test', galleryUrls: [] },
      })
      plan = await prisma.membershipPlan.create({
        data: {
          sportId: sport.id,
          clubId: club.id,
          title: 'Monthly',
          priceCents: 12345,
          currency: 'RUB',
          durationDays: 30,
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
      const auth = { Authorization: `Bearer ${token}`, 'Idempotency-Key': marker }
      const legacy = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId: plan.id })
      assert.equal(legacy.status, 410)

      const tampered = await request(app)
        .post('/api/me/orders')
        .set(auth)
        .send({ passId: plan.id, clubId: club.id, type: 'pass', priceCents: 1 })
      assert.equal(tampered.status, 400)
      assert.equal(await prisma.order.count({ where: { userId: user.id } }), 0)

      const created = await request(app)
        .post('/api/me/orders')
        .set(auth)
        .send({ passId: plan.id, clubId: club.id, type: 'subscription' })
      assert.equal(created.status, 201)
      assert.equal(created.body.status, 'PAYMENT_CREATED')
      assert.equal(created.body.amountCents, 12345)
      assert.equal(created.body.confirmationUrl, 'https://yookassa.test/confirm')
      assert.equal(await prisma.userSubscription.count({ where: { userId: user.id } }), 0)

      const replayCreate = await request(app)
        .post('/api/me/orders')
        .set(auth)
        .send({ planId: plan.id, clubId: club.id, type: 'MEMBERSHIP' })
      assert.equal(replayCreate.status, 200)
      assert.equal(replayCreate.body.id, created.body.id)
      assert.equal(createCalls, 1)

      providerPayment = { ...providerPayment, status: 'succeeded', paid: true, amount: { value: '1.00', currency: 'RUB' } }
      const wrongAmount = await request(app)
        .post('/api/webhooks/yookassa')
        .send({ event: 'payment.succeeded', object: { id: providerPayment.id } })
      assert.equal(wrongAmount.status, 400)
      assert.equal(await prisma.userSubscription.count({ where: { userId: user.id } }), 0)

      providerPayment = { ...providerPayment, amount: { value: '123.45', currency: 'RUB' } }
      const paid = await request(app)
        .post('/api/webhooks/yookassa')
        .send({ event: 'payment.succeeded', object: { id: providerPayment.id } })
      assert.equal(paid.status, 200)
      assert.equal(paid.body.order.status, 'PAID')
      const replayWebhook = await request(app)
        .post('/api/webhooks/yookassa')
        .send({ event: 'payment.succeeded', object: { id: providerPayment.id } })
      assert.equal(replayWebhook.status, 200)
      assert.equal(await prisma.userSubscription.count({ where: { userId: user.id } }), 1)
      const subscriptions = await request(app)
        .get('/api/me/subscriptions')
        .set('Authorization', `Bearer ${token}`)
      assert.equal(subscriptions.status, 200)
      assert.equal(subscriptions.body[0].passId, plan.id)
      assert.equal(subscriptions.body[0].title, plan.title)
      assert.equal(subscriptions.body[0].clubName, club.name)
      assert.equal(subscriptions.body[0].plan.id, plan.id)
    } finally {
      if (user) {
        await prisma.payment.deleteMany({ where: { order: { userId: user.id } } })
        await prisma.order.deleteMany({ where: { userId: user.id } })
        await prisma.userSubscription.deleteMany({ where: { userId: user.id } })
        await prisma.user.deleteMany({ where: { id: user.id } })
      }
      if (plan) await prisma.membershipPlan.deleteMany({ where: { id: plan.id } })
      if (club) await prisma.sportClub.deleteMany({ where: { id: club.id } })
      if (sport) await prisma.sport.deleteMany({ where: { id: sport.id } })
      await prisma.$disconnect()
      await new Promise((resolve) => provider.close(resolve))
    }
  },
)

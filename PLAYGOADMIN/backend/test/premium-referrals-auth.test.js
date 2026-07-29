import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'
import test from 'node:test'

import request from 'supertest'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

test(
  'premium payments extend once, referrals enforce rules, and refresh tokens rotate',
  { skip: testDatabaseUrl ? false : skipWithoutDatabase },
  async () => {
    const payments = new Map()
    let paymentSequence = 0
    const provider = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json')
      if (req.method === 'POST' && req.url === '/v3/payments') {
        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', () => {
          const body = JSON.parse(raw)
          paymentSequence += 1
          const payment = {
            id: `premium-payment-${paymentSequence}`,
            status: 'pending',
            paid: false,
            amount: body.amount,
            metadata: body.metadata,
            confirmation: { confirmation_url: `https://pay.test/${paymentSequence}` },
          }
          payments.set(payment.id, payment)
          res.end(JSON.stringify(payment))
        })
        return
      }
      const externalId = req.url?.match(/^\/v3\/payments\/(.+)$/)?.[1]
      if (req.method === 'GET' && externalId && payments.has(externalId)) {
        res.end(JSON.stringify(payments.get(externalId)))
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
    const [{ default: app }, { default: prisma }, auth] = await Promise.all([
      import('../src/app.js'),
      import('../src/prisma.js'),
      import('../src/lib/auth.js'),
    ])
    const marker = `phase-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
    const users = []

    try {
      for (const suffix of ['owner', 'referred', 'other', 'auth']) {
        users.push(await prisma.user.create({
          data: {
            email: `${marker}-${suffix}@example.com`,
            username: `${marker}-${suffix}`,
            name: suffix,
            passwordHash: auth.hashPassword('password123'),
          },
        }))
      }
      const [owner, referred, other, authUser] = users
      const tokenFor = (user) =>
        auth.signToken({ sub: user.id, email: user.email, username: user.username })
      const bearer = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` })

      const ownerReferral = await request(app).get('/api/me/referral').set(bearer(owner))
      assert.equal(ownerReferral.status, 200)
      assert.match(ownerReferral.body.referralCode, /^[A-F0-9]{10}$/)

      const selfApply = await request(app)
        .post('/api/me/referral/apply')
        .set(bearer(owner))
        .send({ code: ownerReferral.body.referralCode.toLowerCase() })
      assert.equal(selfApply.status, 400)

      const apply = await request(app)
        .post('/api/me/referral/apply')
        .set(bearer(referred))
        .send({ referralCode: ownerReferral.body.referralCode.toLowerCase() })
      assert.equal(apply.status, 201)
      const duplicate = await request(app)
        .post('/api/me/referral/apply')
        .set(bearer(referred))
        .send({ code: ownerReferral.body.referralCode })
      assert.equal(duplicate.status, 409)
      const referralStatus = await request(app).get('/api/me/referral').set(bearer(owner))
      assert.equal(referralStatus.body.referralCount, 1)
      const unknown = await request(app)
        .post('/api/me/referral/apply')
        .set(bearer(other))
        .send({ code: 'DOESNOTEXIST' })
      assert.equal(unknown.status, 404)

      const login = await request(app)
        .post('/api/auth/login')
        .send({ identifier: authUser.email, password: 'password123' })
      assert.equal(login.status, 200)
      assert.ok(login.body.accessToken)
      assert.ok(login.body.refreshToken)
      assert.equal(typeof login.body.expiresIn, 'number')

      const rotated = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
      assert.equal(rotated.status, 200)
      assert.notEqual(rotated.body.refreshToken, login.body.refreshToken)
      const replay = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
      assert.equal(replay.status, 401)
      const logout = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: rotated.body.refreshToken })
      assert.equal(logout.status, 204)
      const afterLogout = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
      assert.equal(afterLogout.status, 401)

      const expiredRaw = crypto.randomBytes(32).toString('base64url')
      await prisma.refreshToken.create({
        data: {
          userId: authUser.id,
          tokenHash: crypto.createHash('sha256').update(expiredRaw).digest('hex'),
          expiresAt: new Date(Date.now() - 1000),
        },
      })
      const expired = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: expiredRaw })
      assert.equal(expired.status, 401)

      const blockedSession = await auth.authResponse(authUser)
      await prisma.user.update({
        where: { id: authUser.id },
        data: { isBlocked: true },
      })
      const blockedRefresh = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: blockedSession.refreshToken })
      assert.equal(blockedRefresh.status, 401)
      await prisma.user.update({
        where: { id: authUser.id },
        data: { isBlocked: false },
      })
      const deletedSession = await auth.authResponse(other)
      await prisma.user.delete({ where: { id: other.id } })
      const deletedRefresh = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: deletedSession.refreshToken })
      assert.equal(deletedRefresh.status, 401)

      const premiumAuth = {
        ...bearer(owner),
        'Idempotency-Key': `${marker}-premium-1`,
      }
      const premiumBefore = await request(app).get('/api/me/premium').set(bearer(owner))
      assert.equal(premiumBefore.status, 200)
      assert.equal(premiumBefore.body.active, false)
      assert.equal(premiumBefore.body.priceCents, 29900)

      const firstOrder = await request(app)
        .post('/api/me/premium')
        .set(premiumAuth)
        .send({})
      assert.equal(firstOrder.status, 201)
      assert.equal(firstOrder.body.type, 'PREMIUM')
      assert.ok(firstOrder.body.confirmationUrl)
      const replayOrder = await request(app)
        .post('/api/me/premium')
        .set(premiumAuth)
        .send({})
      assert.equal(replayOrder.status, 200)
      assert.equal(replayOrder.body.id, firstOrder.body.id)

      const firstPayment = payments.get(firstOrder.body.payment.externalId)
      payments.set(firstPayment.id, { ...firstPayment, status: 'succeeded', paid: true })
      const firstWebhook = await request(app)
        .post('/api/webhooks/yookassa')
        .send({ object: { id: firstPayment.id } })
      assert.equal(firstWebhook.status, 200)
      const firstExpiry = new Date(firstWebhook.body.order.premiumSubscription.expiresAt)
      await request(app).post('/api/webhooks/yookassa').send({ object: { id: firstPayment.id } })
      assert.equal(await prisma.appPremiumSubscription.count({ where: { userId: owner.id } }), 1)

      const secondOrder = await request(app)
        .post('/api/me/premium')
        .set({ ...bearer(owner), 'Idempotency-Key': `${marker}-premium-2` })
        .send({})
      const secondPayment = payments.get(secondOrder.body.payment.externalId)
      payments.set(secondPayment.id, { ...secondPayment, status: 'succeeded', paid: true })
      const secondWebhook = await request(app)
        .post('/api/webhooks/yookassa')
        .send({ object: { id: secondPayment.id } })
      assert.equal(secondWebhook.status, 200)
      const secondExpiry = new Date(secondWebhook.body.order.premiumSubscription.expiresAt)
      assert.equal(
        Math.round((secondExpiry - firstExpiry) / (24 * 60 * 60 * 1000)),
        30,
      )
      const premiumAfter = await request(app).get('/api/me/premium').set(bearer(owner))
      assert.equal(premiumAfter.body.active, true)
      assert.equal(new Date(premiumAfter.body.expiresAt).toISOString(), secondExpiry.toISOString())
    } finally {
      const userIds = users.map((user) => user.id)
      await prisma.payment.deleteMany({ where: { order: { userId: { in: userIds } } } })
      await prisma.order.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.appPremiumSubscription.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.referralRedemption.deleteMany({
        where: { OR: [{ referrerUserId: { in: userIds } }, { referredUserId: { in: userIds } }] },
      })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
      await prisma.$disconnect()
      await new Promise((resolve) => provider.close(resolve))
    }
  },
)

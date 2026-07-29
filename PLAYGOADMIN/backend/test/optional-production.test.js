import assert from 'node:assert/strict'
import test from 'node:test'

import request from 'supertest'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

test(
  'optional production analytics, guest news, history, support, and campaigns',
  { skip: testDatabaseUrl ? false : skipWithoutDatabase },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = testDatabaseUrl
    const [{ default: app }, { default: prisma }, authLib, push] =
      await Promise.all([
        import('../src/app.js'),
        import('../src/prisma.js'),
        import('../src/lib/auth.js'),
        import('../src/lib/pushNotifications.js'),
      ])
    push.setPushSchedulerForTests(() => {})
    push.setPushSenderForTests(async () => ({
      configured: false,
      skippedReason: 'NO_CREDENTIALS',
      responses: [],
    }))

    const marker = `optional-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const adminAuth = [
      process.env.ADMIN_USER || 'admin',
      process.env.ADMIN_PASSWORD || 'admin',
    ]
    let userId
    let programId
    let newsId
    let campaignId
    let sportId
    let clubId
    try {
      const user = await prisma.user.create({
        data: {
          email: `${marker}@example.com`,
          username: marker,
          name: marker,
          passwordHash: authLib.hashPassword('password123'),
        },
      })
      userId = user.id
      const token = authLib.signToken({ sub: user.id, email: user.email })
      const bearer = { Authorization: `Bearer ${token}` }
      const sport = await prisma.sport.create({
        data: { code: marker.toUpperCase().replaceAll('-', '_'), name: marker },
      })
      sportId = sport.id
      const club = await prisma.sportClub.create({
        data: { sportId, name: marker, address: marker, galleryUrls: [] },
      })
      clubId = club.id
      const news = await prisma.news.create({
        data: {
          title: marker,
          body: 'Sponsored guest item',
          type: 'SPONSORED',
          clubId,
        },
      })
      newsId = news.id
      await prisma.newsView.create({ data: { newsId, userId } })
      await prisma.newsUniqueView.create({ data: { newsId, userId } })

      const guestFeed = await request(app).get(`/api/news?clubId=${clubId}`)
      assert.equal(guestFeed.status, 200)
      assert.equal(guestFeed.body[0].type, 'sponsored')
      assert.equal(guestFeed.body[0].viewCount, 1)
      assert.equal(guestFeed.body[0].uniqueViewerCount, 1)
      assert.equal(guestFeed.body[0].club.id, clubId)
      const invalidGuestLimit = await request(app).get('/api/news?limit=unbounded')
      assert.equal(invalidGuestLimit.status, 400)

      const program = await prisma.workoutProgram.create({
        data: { id: marker, title: marker, description: marker },
      })
      programId = program.id
      await prisma.workoutSession.create({
        data: {
          userId,
          programId,
          finishedAt: new Date(),
          durationSeconds: 600,
          source: 'MANUAL',
        },
      })
      const analytics = await request(app)
        .get('/api/admin/workout-analytics')
        .auth(...adminAuth)
      assert.equal(analytics.status, 200)
      assert.ok(analytics.body.metrics.sessions >= 1)
      assert.ok(analytics.body.metrics.users >= 1)
      assert.ok(analytics.body.popularPrograms.some((item) => item.programId === programId))

      const storedHistory = await request(app)
        .post('/api/me/ai-matches')
        .set(bearer)
        .send({ requestJson: { city: 'Moscow' }, resultJson: [{ clubId }] })
      assert.equal(storedHistory.status, 201)
      assert.equal(storedHistory.body.generatesRecommendations, false)
      const history = await request(app).get('/api/me/ai-matches').set(bearer)
      assert.equal(history.body.items.length, 1)

      const ticket = await request(app)
        .post('/api/me/support')
        .set(bearer)
        .send({ subject: marker, message: 'Please help' })
      assert.equal(ticket.status, 201)
      const adminReply = await request(app)
        .post(`/api/admin/support/${ticket.body.id}/replies`)
        .auth(...adminAuth)
        .send({ body: 'We are reviewing this.' })
      assert.equal(adminReply.status, 201)
      const userTickets = await request(app).get('/api/me/support').set(bearer)
      assert.equal(userTickets.body.tickets[0].messages.length, 2)

      await prisma.pushToken.create({
        data: { userId, token: `${marker}-push-token-1234567890`, platform: 'IOS' },
      })
      const campaign = await request(app)
        .post('/api/admin/push-campaigns')
        .auth(...adminAuth)
        .send({
          name: marker,
          title: 'Manual campaign',
          body: 'Safe dispatch',
          targetSegment: 'SELECTED_USERS',
          selectedUserIds: [userId],
        })
      assert.equal(campaign.status, 201)
      campaignId = campaign.body.id
      const sent = await request(app)
        .post(`/api/admin/push-campaigns/${campaignId}/send`)
        .auth(...adminAuth)
      assert.equal(sent.status, 202)
      assert.equal(sent.body.campaign.status, 'SKIPPED')
      assert.equal(sent.body.campaign.pushSentCount, 0)
      assert.equal(sent.body.campaign.inAppCreatedCount, 1)
    } finally {
      push.setPushSenderForTests(null)
      push.setPushSchedulerForTests(null)
      if (campaignId) await prisma.pushCampaign.deleteMany({ where: { id: campaignId } })
      if (newsId) await prisma.news.deleteMany({ where: { id: newsId } })
      if (userId) await prisma.user.deleteMany({ where: { id: userId } })
      if (programId) await prisma.workoutProgram.deleteMany({ where: { id: programId } })
      if (clubId) await prisma.sportClub.deleteMany({ where: { id: clubId } })
      if (sportId) await prisma.sport.deleteMany({ where: { id: sportId } })
      await prisma.$disconnect()
    }
  },
)

import assert from 'node:assert/strict'
import test from 'node:test'

import request from 'supertest'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

test(
  'push tokens, triggers, cleanup, dedupe, and ecosystem aggregate stay consistent',
  { skip: testDatabaseUrl ? false : skipWithoutDatabase },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = testDatabaseUrl
    const [
      { default: app },
      { default: prisma },
      { hashPassword, signToken },
      { createNews },
      push,
      { runSubscriptionExpiryNotifications },
    ] = await Promise.all([
      import('../src/app.js'),
      import('../src/prisma.js'),
      import('../src/lib/auth.js'),
      import('../src/lib/news.js'),
      import('../src/lib/pushNotifications.js'),
      import('../src/lib/subscriptionExpiry.js'),
    ])

    push.setPushSchedulerForTests(() => {})
    const sentBatches = []
    push.setPushSenderForTests(async (message) => {
      sentBatches.push(message)
      return {
        configured: true,
        responses: message.tokens.map((token) =>
          token.includes('invalid')
            ? {
                success: false,
                error: {
                  code: 'messaging/registration-token-not-registered',
                },
              }
            : { success: true, messageId: 'mock-message' },
        ),
      }
    })

    const marker = `push-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const userIds = []
    let sportId
    let clubId
    let planId
    let newsId
    let bookingId
    let subscriptionId
    let chatId

    try {
      const [user, otherUser] = await Promise.all(
        ['owner', 'other'].map(async (suffix) => {
          const created = await prisma.user.create({
            data: {
              email: `${marker}-${suffix}@example.com`,
              username: `${marker}_${suffix}`,
              name: `${marker} ${suffix}`,
              passwordHash: hashPassword('password123'),
            },
          })
          userIds.push(created.id)
          return created
        }),
      )
      const token = signToken({
        sub: user.id,
        email: user.email,
        username: user.username,
      })
      const auth = { Authorization: `Bearer ${token}` }

      const sport = await prisma.sport.create({
        data: {
          code: marker.toUpperCase().replace(/-/g, '_'),
          name: marker,
        },
      })
      sportId = sport.id
      const club = await prisma.sportClub.create({
        data: {
          sportId,
          name: marker,
          address: 'Push test club',
          galleryUrls: [],
        },
      })
      clubId = club.id
      await prisma.favoriteClub.create({
        data: { userId: user.id, clubId },
      })
      const plan = await prisma.membershipPlan.create({
        data: {
          sportId,
          clubId,
          title: 'Expiring plan',
          priceCents: 10000,
          durationDays: 30,
        },
      })
      planId = plan.id
      const subscription = await prisma.userSubscription.create({
        data: {
          userId: user.id,
          sportId,
          clubId,
          planId,
          expiresAt: new Date(Date.now() + 2 * 86_400_000),
          amountCents: plan.priceCents,
          currency: 'RUB',
        },
      })
      subscriptionId = subscription.id

      const invalidToken = `invalid-token-${marker}-0123456789`
      const validToken = `valid-token-${marker}-0123456789`
      const firstRegistration = await request(app)
        .post('/api/me/push-tokens')
        .set(auth)
        .send({
          token: invalidToken,
          platform: 'ios',
          deviceId: 'phone-1',
          appVersion: '1.0.0',
        })
      assert.equal(firstRegistration.status, 200)
      const repeatedRegistration = await request(app)
        .post('/api/me/push-tokens')
        .set(auth)
        .send({
          token: invalidToken,
          platform: 'IOS',
          deviceId: 'phone-1',
          appVersion: '1.1.0',
        })
      assert.equal(repeatedRegistration.status, 200)
      assert.equal(repeatedRegistration.body.pushToken.id, firstRegistration.body.pushToken.id)
      assert.equal(repeatedRegistration.body.pushToken.appVersion, '1.1.0')
      assert.equal(
        await prisma.pushToken.count({ where: { userId: user.id } }),
        1,
      )
      const invalidPlatform = await request(app)
        .post('/api/me/push-tokens')
        .set(auth)
        .send({ token: validToken, platform: 'BLACKBERRY' })
      assert.equal(invalidPlatform.status, 400)
      const validRegistration = await request(app)
        .post('/api/me/push-tokens')
        .set(auth)
        .send({ token: validToken, platform: 'ANDROID', deviceId: 'phone-2' })
      assert.equal(validRegistration.status, 200)

      const news = await createNews({
        title: 'Favorite club update',
        body: 'A favorite club published an update.',
        clubId,
      })
      newsId = news.id
      const newsDedupeKey = `favorite-club-news:${news.id}:${user.id}`
      await push.createNotificationWithPush({
          userId: user.id,
          type: 'FAVORITE_CLUB_NEWS',
          title: news.title,
          body: news.body,
          clubId,
          newsId: news.id,
          dedupeKey: newsDedupeKey,
        })
      await push.createNotificationWithPush({
          userId: user.id,
          type: 'FAVORITE_CLUB_NEWS',
          title: news.title,
          body: news.body,
          clubId,
          newsId: news.id,
          dedupeKey: newsDedupeKey,
        })
      assert.equal(
        await prisma.userNotification.count({ where: { dedupeKey: newsDedupeKey } }),
        1,
      )
      assert.equal(
        await prisma.pushDispatch.count({ where: { dedupeKey: newsDedupeKey } }),
        1,
      )

      const newsDispatch = await prisma.pushDispatch.findUnique({
        where: { dedupeKey: newsDedupeKey },
      })
      const dispatchResult = await push.dispatchPush(newsDispatch.id)
      assert.equal(dispatchResult.status, 'SENT')
      assert.equal(dispatchResult.invalidTokenCount, 1)
      assert.equal(sentBatches.length, 1)
      assert.equal(
        await prisma.pushToken.count({ where: { token: invalidToken } }),
        0,
      )

      const booking = await prisma.trainingBooking.create({
        data: {
          userId: user.id,
          clubId,
          scheduledAt: new Date(Date.now() + 5 * 86_400_000),
          scheduleTitle: 'Confirmed training',
          priceCents: 10000,
          platformFeeCents: 1500,
        },
      })
      bookingId = booking.id
      const adminCredentials = [
        process.env.ADMIN_USER || 'admin',
        process.env.ADMIN_PASSWORD || 'admin',
      ]
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const confirmation = await request(app)
          .patch(`/api/admin/bookings/${booking.id}/status`)
          .auth(...adminCredentials)
          .send({ status: 'CONFIRMED' })
        assert.equal(confirmation.status, 200)
      }
      assert.equal(
        await prisma.userNotification.count({
          where: { dedupeKey: `booking-confirmed:${booking.id}` },
        }),
        1,
      )

      await runSubscriptionExpiryNotifications()
      await runSubscriptionExpiryNotifications()
      assert.equal(
        await prisma.userNotification.count({
          where: {
            dedupeKey: {
              startsWith: `subscription-expiring:MEMBERSHIP:${subscription.id}:`,
            },
          },
        }),
        1,
      )

      const [userAId, userBId] = [user.id, otherUser.id].sort()
      const chat = await prisma.directChat.create({
        data: { userAId, userBId },
      })
      chatId = chat.id
      await prisma.chatMessage.create({
        data: {
          chatId,
          senderUserId: otherUser.id,
          text: 'Unread message',
        },
      })

      const ecosystem = await request(app).get('/api/ecosystem').set(auth)
      assert.equal(ecosystem.status, 200)
      assert.equal(ecosystem.body.counts.favoriteClubs, 1)
      assert.equal(ecosystem.body.counts.unreadChats, 1)
      assert.equal(ecosystem.body.counts.activeSubscriptions, 1)
      assert.equal(ecosystem.body.counts.expiringSubscriptions, 1)
      assert.equal(ecosystem.body.favoriteClubs.length, 1)
      assert.equal(ecosystem.body.highlights.favoriteClubNews[0].id, news.id)
      assert.equal(
        ecosystem.body.highlights.expiringSubscriptions[0].id,
        subscription.id,
      )

      const removal = await request(app)
        .delete(`/api/me/push-tokens/${validRegistration.body.pushToken.id}`)
        .set(auth)
      assert.equal(removal.status, 204)
      assert.equal(
        await prisma.pushToken.count({ where: { userId: user.id } }),
        0,
      )
    } finally {
      push.setPushSenderForTests(null)
      push.setPushSchedulerForTests(null)
      if (chatId) await prisma.directChat.deleteMany({ where: { id: chatId } })
      if (bookingId) {
        await prisma.trainingBooking.deleteMany({ where: { id: bookingId } })
      }
      if (subscriptionId) {
        await prisma.userSubscription.deleteMany({
          where: { id: subscriptionId },
        })
      }
      if (newsId) await prisma.news.deleteMany({ where: { id: newsId } })
      if (userIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } })
      }
      if (planId) {
        await prisma.membershipPlan.deleteMany({ where: { id: planId } })
      }
      if (clubId) {
        await prisma.favoriteClub.deleteMany({ where: { clubId } })
        await prisma.sportClub.deleteMany({ where: { id: clubId } })
      }
      if (sportId) await prisma.sport.deleteMany({ where: { id: sportId } })
      await prisma.$disconnect()
    }
  },
)

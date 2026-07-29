import assert from 'node:assert/strict'
import test from 'node:test'

import request from 'supertest'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

test(
  'clubs expose priced schedules and bookings use server price plus 15% fee',
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

    const marker = `clubs-bookings-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
    const adminCredentials = [
      process.env.ADMIN_USER || 'admin',
      process.env.ADMIN_PASSWORD || 'admin',
    ]
    let sportId
    let cityId
    let clubId
    const userIds = []

    try {
      const sport = await prisma.sport.create({
        data: { code: marker.toUpperCase().replace(/-/g, '_'), name: marker },
      })
      sportId = sport.id
      const city = await prisma.city.create({ data: { name: marker } })
      cityId = city.id
      const club = await prisma.sportClub.create({
        data: {
          sportId,
          cityId,
          name: marker,
          address: 'Test address',
          tier: 'GOLD',
          imageUrl: `http://localhost:4000/uploads/clubs/${marker}.jpg`,
          logoUrl: `http://localhost:4000/uploads/clubs/${marker}.jpg`,
          galleryUrls: [
            `http://localhost:4000/uploads/clubs/${marker}-gallery.jpg`,
          ],
        },
      })
      clubId = club.id

      const createUser = async (suffix, blocked = false) => {
        const user = await prisma.user.create({
          data: {
            email: `${marker}-${suffix}@example.com`,
            username: `${marker}_${suffix}`,
            name: `${marker} ${suffix}`,
            passwordHash: hashPassword('password123'),
            isBlocked: blocked,
          },
        })
        userIds.push(user.id)
        return user
      }
      const customer = await createUser('customer')
      const blockedCustomer = await createUser('blocked', true)
      const coachUser = await createUser('coach')
      const coach = await prisma.coachProfile.create({
        data: {
          userId: coachUser.id,
          clubId,
          firstName: 'Test',
          lastName: 'Coach',
        },
      })

      const future = new Date(Date.now() + 8 * 86_400_000)
      const datePart = future.toISOString().slice(0, 10)
      const scheduledAt = `${datePart}T12:00:00.000Z`
      const weekday = new Date(`${datePart}T00:00:00.000Z`).getUTCDay() || 7
      const schedule = await prisma.clubSchedule.create({
        data: {
          clubId,
          coachProfileId: coach.id,
          title: 'Server priced training',
          dayOfWeek: weekday,
          startTime: '12:00',
          endTime: '13:00',
          priceCents: 10000,
        },
      })
      await prisma.membershipPlan.createMany({
        data: [
          {
            sportId,
            clubId,
            tier: 'GOLD',
            title: 'Active pass',
            priceCents: 700000,
            durationDays: 30,
            isActive: true,
          },
          {
            sportId,
            clubId,
            tier: 'SILVER',
            title: 'Inactive pass',
            priceCents: 500000,
            durationDays: 30,
            isActive: false,
          },
        ],
      })

      const adminClubUpdate = await request(app)
        .put(`/api/admin/clubs/${clubId}`)
        .auth(...adminCredentials)
        .send({
          sportId,
          cityId,
          name: marker,
          address: 'Test address',
          tier: 'GOLD',
          logoUrl: `http://localhost:4000/uploads/clubs/${marker}.jpg`,
          imageUrls: [
            `http://localhost:4000/uploads/clubs/${marker}-gallery.jpg`,
          ],
          schedules: [
            {
              id: schedule.id,
              title: schedule.title,
              dayOfWeek: weekday,
              startTime: '12:00',
              endTime: '13:00',
              priceCents: 10000,
              coachProfileId: coach.id,
            },
          ],
        })
      assert.equal(adminClubUpdate.status, 200)
      assert.equal(adminClubUpdate.body.schedules[0].id, schedule.id)
      assert.equal(adminClubUpdate.body.schedules[0].coachProfileId, coach.id)

      const clubResponse = await request(app).get(`/api/clubs/${clubId}`)
      assert.equal(clubResponse.status, 200)
      assert.equal(clubResponse.body.tier, 'GOLD')
      assert.equal(
        clubResponse.body.logoUrl,
        `/uploads/clubs/${marker}.jpg`,
      )
      assert.deepEqual(
        clubResponse.body.imageUrls,
        [`/uploads/clubs/${marker}-gallery.jpg`],
      )
      assert.equal(clubResponse.body.schedules[0].id, schedule.id)
      assert.equal(clubResponse.body.schedules[0].priceCents, 10000)
      assert.equal(clubResponse.body.schedules[0].coachProfileId, coach.id)
      assert.deepEqual(
        clubResponse.body.passes.map((pass) => pass.title),
        ['Active pass'],
      )

      const tokenFor = (user) =>
        signToken({ sub: user.id, email: user.email, username: user.username })
      const customerToken = tokenFor(customer)

      const tampered = await request(app)
        .post('/api/me/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          scheduleEntryId: schedule.id,
          clubId,
          coachId: coach.id,
          scheduledAt,
          priceCents: 1,
        })
      assert.equal(tampered.status, 400)
      assert.match(tampered.body.error, /server schedule price/)
      assert.equal(
        await prisma.trainingBooking.count({ where: { userId: customer.id } }),
        0,
      )

      const created = await request(app)
        .post('/api/me/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          scheduleId: schedule.id,
          clubId,
          coachId: coachUser.id,
          scheduledAt,
          note: 'Bring gloves',
        })
      assert.equal(created.status, 201)
      assert.equal(created.body.scheduleEntryId, schedule.id)
      assert.equal(created.body.scheduleId, schedule.id)
      assert.equal(created.body.coachProfileId, coach.id)
      assert.equal(created.body.priceCents, 10000)
      assert.equal(created.body.platformFeeCents, 1500)
      assert.equal(created.body.status, 'PENDING')

      await prisma.clubSchedule.update({
        where: { id: schedule.id },
        data: { priceCents: 12000 },
      })
      const mine = await request(app)
        .get('/api/me/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
      assert.equal(mine.status, 200)
      assert.equal(mine.body.length, 1)
      assert.equal(mine.body[0].priceCents, 10000)
      assert.equal(mine.body[0].platformFeeCents, 1500)

      const blocked = await request(app)
        .post('/api/me/bookings')
        .set('Authorization', `Bearer ${tokenFor(blockedCustomer)}`)
        .send({ scheduleEntryId: schedule.id, scheduledAt })
      assert.equal(blocked.status, 403)

      const adminList = await request(app)
        .get(`/api/admin/bookings?clubId=${clubId}`)
        .auth(...adminCredentials)
      assert.equal(adminList.status, 200)
      assert.equal(adminList.body.length, 1)
      const updated = await request(app)
        .patch(`/api/admin/bookings/${created.body.id}/status`)
        .auth(...adminCredentials)
        .send({ status: 'confirmed' })
      assert.equal(updated.status, 200)
      assert.equal(updated.body.status, 'CONFIRMED')
    } finally {
      if (clubId) {
        await prisma.trainingBooking.deleteMany({ where: { clubId } })
        await prisma.membershipPlan.deleteMany({ where: { clubId } })
        await prisma.clubSchedule.deleteMany({ where: { clubId } })
        await prisma.coachProfile.deleteMany({ where: { clubId } })
        await prisma.sportClub.deleteMany({ where: { id: clubId } })
      }
      if (userIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } })
      }
      if (sportId) await prisma.sport.deleteMany({ where: { id: sportId } })
      if (cityId) await prisma.city.deleteMany({ where: { id: cityId } })
      await prisma.$disconnect()
    }
  },
)

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'

import request from 'supertest'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const skipWithoutDatabase =
  'TEST_DATABASE_URL is not set; refusing to use the development database'

test(
  'username search, friendships create chats, and clubs search by name',
  { skip: testDatabaseUrl ? false : skipWithoutDatabase },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = testDatabaseUrl
    const [{ default: app }, { default: prisma }, auth] = await Promise.all([
      import('../src/app.js'),
      import('../src/prisma.js'),
      import('../src/lib/auth.js'),
    ])

    const marker = `friends-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
    const users = []
    let sportId
    let cityId
    let clubId

    try {
      for (const suffix of ['alice', 'bob', 'carol']) {
        users.push(
          await prisma.user.create({
            data: {
              email: `${marker}-${suffix}@example.com`,
              username: `${marker}_${suffix}`,
              firstName: suffix,
              lastName: 'Tester',
              name: suffix,
              passwordHash: auth.hashPassword('password123'),
            },
          }),
        )
      }
      const [alice, bob, carol] = users
      const tokenFor = (user) =>
        auth.signToken({ sub: user.id, email: user.email, username: user.username })
      const bearer = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` })

      const missingQuery = await request(app).get('/api/users/search').set(bearer(alice))
      assert.equal(missingQuery.status, 400)

      const search = await request(app)
        .get('/api/users/search')
        .query({ username: `${marker}_bo` })
        .set(bearer(alice))
      assert.equal(search.status, 200)
      assert.equal(search.body.users.length, 1)
      assert.equal(search.body.users[0].user.id, bob.id)
      assert.equal(search.body.users[0].relation, 'NONE')

      const requestFriend = await request(app)
        .post('/api/me/friends')
        .set(bearer(alice))
        .send({ userId: bob.id })
      assert.equal(requestFriend.status, 201)
      assert.equal(requestFriend.body.friendship.status, 'PENDING')
      assert.equal(requestFriend.body.friendship.relation, 'PENDING_OUTGOING')

      const incoming = await request(app).get('/api/me/friends/requests').set(bearer(bob))
      assert.equal(incoming.status, 200)
      assert.equal(incoming.body.requests.length, 1)
      assert.equal(incoming.body.requests[0].id, requestFriend.body.friendship.id)

      const accept = await request(app)
        .post(`/api/me/friends/${requestFriend.body.friendship.id}/accept`)
        .set(bearer(bob))
      assert.equal(accept.status, 200)
      assert.equal(accept.body.friendship.status, 'ACCEPTED')
      assert.equal(accept.body.friendship.relation, 'FRIENDS')
      assert.ok(accept.body.friendship.chatId)

      const friends = await request(app).get('/api/me/friends').set(bearer(alice))
      assert.equal(friends.status, 200)
      assert.equal(friends.body.friends.length, 1)
      assert.equal(friends.body.friends[0].user.id, bob.id)
      assert.equal(friends.body.friends[0].chatId, accept.body.friendship.chatId)

      const searchFriends = await request(app)
        .get('/api/users/search')
        .query({ q: `${marker}_bob` })
        .set(bearer(alice))
      assert.equal(searchFriends.status, 200)
      assert.equal(searchFriends.body.users[0].relation, 'FRIENDS')
      assert.equal(searchFriends.body.users[0].chatId, accept.body.friendship.chatId)

      const reverseRequest = await request(app)
        .post('/api/me/friends')
        .set(bearer(carol))
        .send({ userId: alice.id })
      assert.equal(reverseRequest.status, 201)
      const autoAccept = await request(app)
        .post('/api/me/friends')
        .set(bearer(alice))
        .send({ userId: carol.id })
      assert.equal(autoAccept.status, 201)
      assert.equal(autoAccept.body.friendship.status, 'ACCEPTED')
      assert.ok(autoAccept.body.friendship.chatId)

      const remove = await request(app)
        .delete(`/api/me/friends/${bob.id}`)
        .set(bearer(alice))
      assert.equal(remove.status, 204)
      const afterRemove = await request(app).get('/api/me/friends').set(bearer(alice))
      assert.equal(afterRemove.body.friends.some((row) => row.user.id === bob.id), false)

      const chatStillThere = await request(app)
        .get(`/api/me/chats/${accept.body.friendship.chatId}`)
        .set(bearer(alice))
      assert.equal(chatStillThere.status, 200)

      const sport = await prisma.sport.create({
        data: {
          code: marker.toUpperCase().replace(/-/g, '_').slice(0, 40),
          name: marker,
        },
      })
      sportId = sport.id
      const city = await prisma.city.create({ data: { name: marker } })
      cityId = city.id
      const club = await prisma.sportClub.create({
        data: {
          name: `${marker} Iron Gym`,
          sportId,
          cityId,
          address: 'Test street 1',
          tier: 'BRONZE',
        },
      })
      clubId = club.id

      const clubSearch = await request(app).get('/api/clubs').query({ q: 'Iron Gym' })
      assert.equal(clubSearch.status, 200)
      assert.ok(clubSearch.body.some((row) => row.id === clubId))

      const clubMiss = await request(app).get('/api/clubs').query({ name: 'NoSuchClubXYZ' })
      assert.equal(clubMiss.status, 200)
      assert.equal(clubMiss.body.some((row) => row.id === clubId), false)
    } finally {
      if (clubId) await prisma.sportClub.deleteMany({ where: { id: clubId } }).catch(() => {})
      if (cityId) await prisma.city.deleteMany({ where: { id: cityId } }).catch(() => {})
      if (sportId) await prisma.sport.deleteMany({ where: { id: sportId } }).catch(() => {})
      if (users.length) {
        await prisma.friendship.deleteMany({
          where: {
            OR: [
              { requesterId: { in: users.map((u) => u.id) } },
              { addresseeId: { in: users.map((u) => u.id) } },
            ],
          },
        }).catch(() => {})
        await prisma.chatMessage.deleteMany({
          where: { senderUserId: { in: users.map((u) => u.id) } },
        }).catch(() => {})
        await prisma.directChat.deleteMany({
          where: {
            OR: [
              { userAId: { in: users.map((u) => u.id) } },
              { userBId: { in: users.map((u) => u.id) } },
            ],
          },
        }).catch(() => {})
        await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } }).catch(() => {})
      }
    }
  },
)

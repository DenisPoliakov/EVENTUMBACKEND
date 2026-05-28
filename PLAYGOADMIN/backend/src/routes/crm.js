import express from 'express'
import prisma from '../prisma.js'

const router = express.Router()

const DAY_MS = 24 * 60 * 60 * 1000

function formatMoney(cents = 0, currency = 'RUB') {
  return {
    amountCents: cents,
    currency,
  }
}

function maxDate(...values) {
  const dates = values.filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite)
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null
}

function buildClientStatus({ user, registrations, subscriptions }) {
  const now = Date.now()
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'ACTIVE' && new Date(subscription.expiresAt).getTime() > now)
  const pendingRegistrations = registrations.filter((registration) => registration.status === 'PENDING')
  const approvedRegistrations = registrations.filter((registration) => registration.status === 'APPROVED')
  const recentActivityAt = maxDate(
    user.updatedAt,
    ...registrations.map((registration) => registration.updatedAt || registration.createdAt),
    ...subscriptions.map((subscription) => subscription.updatedAt || subscription.createdAt),
  )
  const inactiveDays = recentActivityAt ? Math.floor((now - new Date(recentActivityAt).getTime()) / DAY_MS) : 999

  if (user.isBlocked || (user.blockedUntil && new Date(user.blockedUntil).getTime() > now)) return 'BLOCKED'
  if (pendingRegistrations.length > 0) return 'NEEDS_ATTENTION'
  if (activeSubscriptions.length > 0 || approvedRegistrations.length >= 3) return 'VIP'
  if (inactiveDays > 45 && (registrations.length > 0 || subscriptions.length > 0)) return 'AT_RISK'
  if (registrations.length > 0 || subscriptions.length > 0 || user.memberships?.length > 0) return 'ACTIVE'
  return 'NEW'
}

function buildNextAction({ user, registrations, subscriptions, favoriteClubs }) {
  const now = Date.now()
  const pending = registrations.find((registration) => registration.status === 'PENDING')
  if (pending) return 'Разобрать заявку и связаться с капитаном'

  const expiring = subscriptions.find((subscription) => {
    if (subscription.status !== 'ACTIVE') return false
    const diffDays = Math.ceil((new Date(subscription.expiresAt).getTime() - now) / DAY_MS)
    return diffDays >= 0 && diffDays <= 7
  })
  if (expiring) return 'Предложить продление абонемента'

  if (!user.playerCard) return 'Подсказать заполнить карточку игрока'
  if (favoriteClubs.length > 0 && subscriptions.length === 0) return 'Предложить пробное занятие или абонемент'
  if (registrations.length === 0 && user.memberships?.length > 0) return 'Пригласить команду на ближайший матч'
  return 'Поддерживать контакт и следить за активностью'
}

function buildSegments({ user, registrations, subscriptions, favoriteClubs }) {
  const segments = []
  if (user.captainedTeams?.length > 0) segments.push('Капитан')
  if (user.coachProfile) segments.push('Тренер')
  if (user.playerCard) segments.push('Игрок')
  if (registrations.some((registration) => registration.status === 'PENDING')) segments.push('Ждет модерации')
  if (registrations.some((registration) => registration.status === 'REJECTED')) segments.push('Был отказ')
  if (subscriptions.some((subscription) => subscription.status === 'ACTIVE')) segments.push('Абонемент')
  if (favoriteClubs.length > 0) segments.push('Любимые клубы')
  if (user.matchBanUntil && new Date(user.matchBanUntil).getTime() > Date.now()) segments.push('Бан заявок')
  if (user.isBlocked) segments.push('Блок')
  return segments
}

function buildActivity({ user, registrations, subscriptions, favoriteClubs }) {
  const activity = [
    {
      id: `user-${user.id}`,
      type: 'USER_CREATED',
      title: 'Пользователь зарегистрировался',
      meta: user.city?.name || user.email,
      at: user.createdAt,
    },
  ]

  user.memberships?.forEach((membership) => {
    activity.push({
      id: `membership-${membership.id}`,
      type: 'TEAM_MEMBER',
      title: `В команде ${membership.team?.name || ''}`.trim(),
      meta: membership.role,
      at: membership.createdAt,
    })
  })

  registrations.forEach((registration) => {
    activity.push({
      id: `registration-${registration.id}`,
      type: 'MATCH_REGISTRATION',
      title: `Заявка: ${registration.teamName}`,
      meta: `${registration.status} · ${registration.match?.stadium?.name || 'Матч'}`,
      at: registration.createdAt,
    })
  })

  subscriptions.forEach((subscription) => {
    activity.push({
      id: `subscription-${subscription.id}`,
      type: 'SUBSCRIPTION',
      title: subscription.plan?.title || 'Абонемент',
      meta: `${subscription.status} · ${subscription.club?.name || subscription.sport?.name || ''}`.trim(),
      at: subscription.createdAt,
    })
  })

  favoriteClubs.forEach((favorite) => {
    activity.push({
      id: `favorite-${favorite.id}`,
      type: 'FAVORITE_CLUB',
      title: `Добавил клуб в избранное`,
      meta: favorite.club?.name || '',
      at: favorite.createdAt,
    })
  })

  return activity
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8)
}

router.get('/overview', async (req, res, next) => {
  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS)
    const monthAgo = new Date(now.getTime() - 30 * DAY_MS)

    const [users, registrations, subscriptions, matches] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          city: true,
          playerCard: true,
          coachProfile: { include: { club: true } },
          memberships: { include: { team: true } },
          captainedTeams: true,
          favoriteClubs: { include: { club: { include: { city: true, sport: true } } } },
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            include: { sport: true, club: true, plan: true },
          },
        },
      }),
      prisma.matchRegistration.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          team: { include: { captain: true } },
          match: { include: { stadium: { include: { city: true } } } },
        },
      }),
      prisma.userSubscription.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: true, sport: true, club: true, plan: true },
      }),
      prisma.match.findMany({
        where: { startTime: { gte: now }, status: { in: ['OPEN', 'FULL'] } },
        orderBy: { startTime: 'asc' },
        include: { stadium: { include: { city: true } }, registrations: true },
        take: 12,
      }),
    ])

    const registrationsByUserId = new Map()
    registrations.forEach((registration) => {
      const userId = registration.team?.captainUserId
      if (!userId) return
      const list = registrationsByUserId.get(userId) || []
      list.push(registration)
      registrationsByUserId.set(userId, list)
    })

    const clients = users.map((user) => {
      const userRegistrations = registrationsByUserId.get(user.id) || []
      const userSubscriptions = user.subscriptions || []
      const favoriteClubs = user.favoriteClubs || []
      const status = buildClientStatus({ user, registrations: userRegistrations, subscriptions: userSubscriptions })
      const lastActivityAt = maxDate(
        user.updatedAt,
        ...userRegistrations.map((registration) => registration.updatedAt || registration.createdAt),
        ...userSubscriptions.map((subscription) => subscription.updatedAt || subscription.createdAt),
        ...favoriteClubs.map((favorite) => favorite.createdAt),
      )

      return {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        city: user.city,
        role: user.role,
        isBlocked: user.isBlocked,
        blockedUntil: user.blockedUntil,
        matchBanUntil: user.matchBanUntil,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        status,
        segments: buildSegments({ user, registrations: userRegistrations, subscriptions: userSubscriptions, favoriteClubs }),
        nextAction: buildNextAction({ user, registrations: userRegistrations, subscriptions: userSubscriptions, favoriteClubs }),
        lastActivityAt,
        stats: {
          registrations: userRegistrations.length,
          pendingRegistrations: userRegistrations.filter((registration) => registration.status === 'PENDING').length,
          approvedRegistrations: userRegistrations.filter((registration) => registration.status === 'APPROVED').length,
          rejectedRegistrations: userRegistrations.filter((registration) => registration.status === 'REJECTED').length,
          teams: user.memberships?.length || 0,
          captainedTeams: user.captainedTeams?.length || 0,
          subscriptions: userSubscriptions.length,
          activeSubscriptions: userSubscriptions.filter((subscription) => subscription.status === 'ACTIVE').length,
          favoriteClubs: favoriteClubs.length,
        },
        registrations: userRegistrations.slice(0, 5),
        subscriptions: userSubscriptions.slice(0, 5),
        favoriteClubs: favoriteClubs.slice(0, 5),
        activity: buildActivity({ user, registrations: userRegistrations, subscriptions: userSubscriptions, favoriteClubs }),
      }
    })

    const revenueCents = subscriptions.reduce((sum, subscription) => sum + (subscription.amountCents || 0), 0)
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'ACTIVE')
    const pendingRegistrations = registrations.filter((registration) => registration.status === 'PENDING')
    const expiringSubscriptions = activeSubscriptions.filter((subscription) => {
      const diffDays = Math.ceil((new Date(subscription.expiresAt).getTime() - now.getTime()) / DAY_MS)
      return diffDays >= 0 && diffDays <= 7
    })
    const upcomingMatchesNeedTeams = matches
      .map((match) => {
        const approved = match.registrations.filter((registration) => registration.status === 'APPROVED').length
        return {
          ...match,
          approvedTeams: approved,
          emptySlots: Math.max(0, match.maxTeams - approved),
        }
      })
      .filter((match) => match.emptySlots > 0)

    res.json({
      summary: {
        clientsTotal: users.length,
        newClientsWeek: users.filter((user) => new Date(user.createdAt) >= weekAgo).length,
        activeClientsMonth: clients.filter((client) => client.lastActivityAt && new Date(client.lastActivityAt) >= monthAgo).length,
        pendingRegistrations: pendingRegistrations.length,
        activeSubscriptions: activeSubscriptions.length,
        expiringSubscriptions: expiringSubscriptions.length,
        revenue: formatMoney(revenueCents, subscriptions[0]?.currency || 'RUB'),
        matchesNeedTeams: upcomingMatchesNeedTeams.length,
      },
      attention: {
        pendingRegistrations: pendingRegistrations.slice(0, 8),
        expiringSubscriptions: expiringSubscriptions.slice(0, 8),
        matchesNeedTeams: upcomingMatchesNeedTeams.slice(0, 8),
      },
      clients: clients.sort((a, b) => {
        const important = ['NEEDS_ATTENTION', 'AT_RISK', 'VIP', 'ACTIVE', 'NEW', 'BLOCKED']
        const byStatus = important.indexOf(a.status) - important.indexOf(b.status)
        if (byStatus !== 0) return byStatus
        return new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime()
      }),
    })
  } catch (err) {
    next(err)
  }
})

export default router

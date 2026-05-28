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

function serializeSport(sport) {
  return {
    id: sport.id,
    code: sport.code,
    name: sport.name,
    description: sport.description || '',
  }
}

function maxDate(...values) {
  const dates = values.filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite)
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null
}

function userMatchesSport({ user, registrations, selectedSportCode }) {
  if (!selectedSportCode) return true

  if (selectedSportCode === 'FOOTBALL') {
    return Boolean(
      user.playerCard ||
        user.memberships?.length ||
        user.captainedTeams?.length ||
        registrations.length ||
        user.subscriptions?.some((subscription) => subscription.sport?.code === selectedSportCode) ||
        user.favoriteClubs?.some((favorite) => favorite.club?.sport?.code === selectedSportCode) ||
        user.coachProfile?.club?.sport?.code === selectedSportCode,
    )
  }

  return Boolean(
    user.subscriptions?.some((subscription) => subscription.sport?.code === selectedSportCode) ||
      user.favoriteClubs?.some((favorite) => favorite.club?.sport?.code === selectedSportCode) ||
      user.coachProfile?.club?.sport?.code === selectedSportCode,
  )
}

function filterSubscriptionsBySport(subscriptions, selectedSportCode) {
  if (!selectedSportCode) return subscriptions
  return subscriptions.filter((subscription) => subscription.sport?.code === selectedSportCode)
}

function filterFavoritesBySport(favoriteClubs, selectedSportCode) {
  if (!selectedSportCode) return favoriteClubs
  return favoriteClubs.filter((favorite) => favorite.club?.sport?.code === selectedSportCode)
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
    const selectedSportCode =
      typeof req.query.sportCode === 'string' && req.query.sportCode !== 'ALL'
        ? req.query.sportCode.trim().toUpperCase()
        : ''
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS)
    const monthAgo = new Date(now.getTime() - 30 * DAY_MS)

    const [sports, users, registrations, subscriptions, matches, coachProfiles, clubs] = await Promise.all([
      prisma.sport.findMany({ orderBy: { name: 'asc' } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          city: true,
          playerCard: true,
          coachProfile: { include: { club: { include: { sport: true, city: true } } } },
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
      prisma.coachProfile.findMany({
        orderBy: [{ experienceYears: 'desc' }, { createdAt: 'desc' }],
        include: {
          user: true,
          club: {
            include: {
              city: true,
              sport: true,
              subscriptions: { include: { user: true } },
              favoritedBy: { include: { user: true } },
            },
          },
        },
      }),
      prisma.sportClub.findMany({
        orderBy: { name: 'asc' },
        include: {
          sport: true,
          city: true,
          schedules: true,
          plans: true,
          coachProfiles: { include: { user: true } },
          subscriptions: { include: { user: true, plan: true } },
          favoritedBy: { include: { user: true } },
        },
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

    const relevantRegistrations = selectedSportCode && selectedSportCode !== 'FOOTBALL' ? [] : registrations
    const relevantSubscriptions = filterSubscriptionsBySport(subscriptions, selectedSportCode)
    const relevantMatches = selectedSportCode && selectedSportCode !== 'FOOTBALL' ? [] : matches
    const relevantUsers = users.filter((user) =>
      userMatchesSport({
        user,
        registrations: registrationsByUserId.get(user.id) || [],
        selectedSportCode,
      }),
    )

    const clients = relevantUsers.map((user) => {
      const userRegistrations = selectedSportCode && selectedSportCode !== 'FOOTBALL' ? [] : registrationsByUserId.get(user.id) || []
      const userSubscriptions = filterSubscriptionsBySport(user.subscriptions || [], selectedSportCode)
      const favoriteClubs = filterFavoritesBySport(user.favoriteClubs || [], selectedSportCode)
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

    const revenueCents = relevantSubscriptions.reduce((sum, subscription) => sum + (subscription.amountCents || 0), 0)
    const activeSubscriptions = relevantSubscriptions.filter((subscription) => subscription.status === 'ACTIVE')
    const pendingRegistrations = relevantRegistrations.filter((registration) => registration.status === 'PENDING')
    const expiringSubscriptions = activeSubscriptions.filter((subscription) => {
      const diffDays = Math.ceil((new Date(subscription.expiresAt).getTime() - now.getTime()) / DAY_MS)
      return diffDays >= 0 && diffDays <= 7
    })
    const upcomingMatchesNeedTeams = relevantMatches
      .map((match) => {
        const approved = match.registrations.filter((registration) => registration.status === 'APPROVED').length
        return {
          ...match,
          approvedTeams: approved,
          emptySlots: Math.max(0, match.maxTeams - approved),
        }
      })
      .filter((match) => match.emptySlots > 0)

    const relevantClubs = clubs.filter((club) => {
      if (!selectedSportCode) return true
      return club.sport?.code === selectedSportCode
    })
    const crmClubs = relevantClubs.map((club) => {
      const activeClubSubscriptions = club.subscriptions.filter(
        (subscription) => subscription.status === 'ACTIVE' && new Date(subscription.expiresAt).getTime() > now.getTime(),
      )
      const expiringClubSubscriptions = activeClubSubscriptions.filter((subscription) => {
        const diffDays = Math.ceil((new Date(subscription.expiresAt).getTime() - now.getTime()) / DAY_MS)
        return diffDays >= 0 && diffDays <= 7
      })
      const revenueCents = club.subscriptions.reduce((sum, subscription) => sum + (subscription.amountCents || 0), 0)
      const activePlanCount = club.plans.filter((plan) => plan.isActive).length

      return {
        id: club.id,
        name: club.name,
        kind: club.kind || '',
        city: club.city?.name || '',
        address: club.address,
        description: club.description || '',
        imageUrl: club.imageUrl || '',
        contactPhone: club.contactPhone || '',
        contactEmail: club.contactEmail || '',
        websiteUrl: club.websiteUrl || '',
        telegramUrl: club.telegramUrl || '',
        vkUrl: club.vkUrl || '',
        instagramUrl: club.instagramUrl || '',
        sport: club.sport ? serializeSport(club.sport) : null,
        stats: {
          coaches: club.coachProfiles.length,
          schedules: club.schedules.length,
          plans: club.plans.length,
          activePlans: activePlanCount,
          subscriptions: club.subscriptions.length,
          activeSubscriptions: activeClubSubscriptions.length,
          expiringSubscriptions: expiringClubSubscriptions.length,
          favoriteUsers: club.favoritedBy.length,
          revenue: formatMoney(revenueCents, club.subscriptions[0]?.currency || 'RUB'),
        },
        coaches: club.coachProfiles.slice(0, 4).map((profile) => ({
          id: profile.id,
          name: `${profile.firstName} ${profile.lastName}`.trim(),
          phone: profile.user?.phone || '',
        })),
        schedules: club.schedules
          .slice()
          .sort((a, b) => (a.dayOfWeek ?? 9) - (b.dayOfWeek ?? 9) || a.startTime.localeCompare(b.startTime))
          .slice(0, 4)
          .map((schedule) => ({
            id: schedule.id,
            title: schedule.title || '',
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            ageGroup: schedule.ageGroup || '',
            coachName: schedule.coachName || '',
          })),
        nextAction:
          club.coachProfiles.length === 0
            ? 'Добавить тренеров к клубу'
            : activePlanCount === 0
              ? 'Включить или создать абонементы'
              : expiringClubSubscriptions.length > 0
                ? 'Проработать продления абонементов'
                : club.favoritedBy.length > activeClubSubscriptions.length
                  ? 'Конвертировать избранное в покупку'
                  : 'Поддерживать расписание и продажи',
      }
    })

    const relevantCoachProfiles = coachProfiles.filter((profile) => {
      if (!selectedSportCode) return true
      return profile.club?.sport?.code === selectedSportCode
    })
    const coachUserIds = relevantCoachProfiles.map((profile) => profile.userId)
    const coachChats = coachUserIds.length
      ? await prisma.directChat.findMany({
          where: {
            OR: [{ userAId: { in: coachUserIds } }, { userBId: { in: coachUserIds } }],
          },
          select: { userAId: true, userBId: true, updatedAt: true },
        })
      : []

    const coaches = relevantCoachProfiles.map((profile) => {
      const clubSubscriptions = profile.club?.subscriptions || []
      const activeStudentIds = new Set(
        clubSubscriptions
          .filter((subscription) => subscription.status === 'ACTIVE' && new Date(subscription.expiresAt).getTime() > now.getTime())
          .map((subscription) => subscription.userId),
      )
      const allStudentIds = new Set(clubSubscriptions.map((subscription) => subscription.userId))
      const favoriteProspects = new Set((profile.club?.favoritedBy || []).map((favorite) => favorite.userId))
      const chatProspects = new Set(
        coachChats
          .filter((chat) => chat.userAId === profile.userId || chat.userBId === profile.userId)
          .map((chat) => (chat.userAId === profile.userId ? chat.userBId : chat.userAId))
          .filter((userId) => !allStudentIds.has(userId)),
      )

      return {
        id: profile.id,
        userId: profile.userId,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        phone: profile.user?.phone || '',
        email: profile.user?.email || '',
        username: profile.user?.username || '',
        experienceYears: profile.experienceYears,
        description: profile.description || profile.achievements || '',
        achievements: profile.achievements || '',
        photoUrl: profile.photoUrl || '',
        telegramUrl: profile.telegramUrl || '',
        club: profile.club
          ? {
              id: profile.club.id,
              name: profile.club.name,
              kind: profile.club.kind || '',
              city: profile.club.city?.name || '',
              sport: profile.club.sport ? serializeSport(profile.club.sport) : null,
            }
          : null,
        stats: {
          activeStudents: activeStudentIds.size,
          totalStudents: allStudentIds.size,
          prospects: new Set([...favoriteProspects, ...chatProspects]).size,
          chats: coachChats.filter((chat) => chat.userAId === profile.userId || chat.userBId === profile.userId).length,
        },
      }
    })

    const footballBreakdown = {
      code: 'FOOTBALL',
      name: 'Футбол',
      clients: users.filter((user) =>
        userMatchesSport({
          user,
          registrations: registrationsByUserId.get(user.id) || [],
          selectedSportCode: 'FOOTBALL',
        }),
      ).length,
      pendingRegistrations: registrations.filter((registration) => registration.status === 'PENDING').length,
      activeSubscriptions: subscriptions.filter((subscription) => subscription.sport?.code === 'FOOTBALL' && subscription.status === 'ACTIVE').length,
      coaches: coachProfiles.filter((profile) => profile.club?.sport?.code === 'FOOTBALL').length,
      clubs: clubs.filter((club) => club.sport?.code === 'FOOTBALL').length,
    }
    const sportBreakdown = [
      footballBreakdown,
      ...sports
        .filter((sport) => sport.code !== 'FOOTBALL')
        .map((sport) => ({
          code: sport.code,
          name: sport.name,
          clients: users.filter((user) =>
            userMatchesSport({
              user,
              registrations: [],
              selectedSportCode: sport.code,
            }),
          ).length,
          pendingRegistrations: 0,
          activeSubscriptions: subscriptions.filter((subscription) => subscription.sport?.code === sport.code && subscription.status === 'ACTIVE').length,
          coaches: coachProfiles.filter((profile) => profile.club?.sport?.code === sport.code).length,
          clubs: clubs.filter((club) => club.sport?.code === sport.code).length,
        })),
    ]

    res.json({
      sports: [
        { code: 'ALL', name: 'Все направления' },
        ...sportBreakdown.map((sport) => ({ code: sport.code, name: sport.name })),
      ],
      selectedSportCode: selectedSportCode || 'ALL',
      sportBreakdown,
      summary: {
        clientsTotal: relevantUsers.length,
        newClientsWeek: relevantUsers.filter((user) => new Date(user.createdAt) >= weekAgo).length,
        activeClientsMonth: clients.filter((client) => client.lastActivityAt && new Date(client.lastActivityAt) >= monthAgo).length,
        pendingRegistrations: pendingRegistrations.length,
        activeSubscriptions: activeSubscriptions.length,
        expiringSubscriptions: expiringSubscriptions.length,
        revenue: formatMoney(revenueCents, relevantSubscriptions[0]?.currency || 'RUB'),
        matchesNeedTeams: upcomingMatchesNeedTeams.length,
        coaches: coaches.length,
        clubs: crmClubs.length,
      },
      attention: {
        pendingRegistrations: pendingRegistrations.slice(0, 8),
        expiringSubscriptions: expiringSubscriptions.slice(0, 8),
        matchesNeedTeams: upcomingMatchesNeedTeams.slice(0, 8),
      },
      clubs: crmClubs.sort((a, b) => {
        const byActive = b.stats.activeSubscriptions - a.stats.activeSubscriptions
        if (byActive !== 0) return byActive
        return b.stats.favoriteUsers - a.stats.favoriteUsers
      }),
      coaches,
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

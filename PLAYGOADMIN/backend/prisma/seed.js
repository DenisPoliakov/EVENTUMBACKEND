import crypto from 'node:crypto'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo123!'
const requestedUserCount = Number.parseInt(process.env.DEMO_USER_COUNT || '12', 10)
const demoUserCount = Math.min(Math.max(Number.isFinite(requestedUserCount) ? requestedUserCount : 12, 6), 100)

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const daysFromNow = (days, hour = 12) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(hour, 0, 0, 0)
  return date
}

const DEMO_CITIES = ['Москва', 'Санкт-Петербург', 'Новосибирск']

const DEMO_SPORTS = [
  {
    code: 'FOOTBALL',
    name: 'Футбол',
    description: 'Футбольные клубы, матчи и команды',
  },
  {
    code: 'BOXING',
    name: 'Бокс',
    description: 'Боксёрские клубы, секции и персональные тренировки',
  },
  {
    code: 'FITNESS',
    name: 'Фитнес',
    description: 'Тренажёрные залы и групповые занятия',
  },
]

const DEMO_CLUBS = [
  {
    key: 'moscow-football',
    sportCode: 'FOOTBALL',
    city: 'Москва',
    name: 'Eventum Football Arena',
    kind: 'Футбольный клуб',
    address: 'Ленинградский проспект, 36',
    description: 'Большой футбольный центр с крытыми полями и детской академией.',
    latitude: 55.791944,
    longitude: 37.559444,
    tier: 'GOLD',
    minAge: 6,
    maxAge: 60,
  },
  {
    key: 'moscow-boxing',
    sportCode: 'BOXING',
    city: 'Москва',
    name: 'Красный Угол',
    kind: 'Боксёрский клуб',
    address: 'улица Большая Дмитровка, 20',
    description: 'Бокс для начинающих и опытных спортсменов.',
    latitude: 55.7652,
    longitude: 37.6116,
    tier: 'SILVER',
    minAge: 12,
    maxAge: 55,
  },
  {
    key: 'spb-fitness',
    sportCode: 'FITNESS',
    city: 'Санкт-Петербург',
    name: 'Нева Fitness',
    kind: 'Фитнес-клуб',
    address: 'Невский проспект, 88',
    description: 'Тренажёрный зал, функциональные тренировки и растяжка.',
    latitude: 59.9328,
    longitude: 30.3494,
    tier: 'GOLD',
    minAge: 16,
    maxAge: null,
  },
  {
    key: 'spb-football',
    sportCode: 'FOOTBALL',
    city: 'Санкт-Петербург',
    name: 'Балтика Спорт',
    kind: 'Футбольный клуб',
    address: 'Петроградская набережная, 18',
    description: 'Любительские лиги и тренировки для взрослых.',
    latitude: 59.9585,
    longitude: 30.3401,
    tier: 'BRONZE',
    minAge: 18,
    maxAge: 50,
  },
  {
    key: 'nsk-fitness',
    sportCode: 'FITNESS',
    city: 'Новосибирск',
    name: 'Сибирь Fitness',
    kind: 'Фитнес-клуб',
    address: 'улица Титова, 22',
    description: 'Современный районный фитнес-клуб рядом с метро.',
    latitude: 54.9824,
    longitude: 82.8805,
    tier: 'SILVER',
    minAge: 14,
    maxAge: null,
  },
  {
    key: 'nsk-boxing',
    sportCode: 'BOXING',
    city: 'Новосибирск',
    name: 'Сибирский Ринг',
    kind: 'Боксёрский клуб',
    address: 'Красный проспект, 79',
    description: 'Групповые и персональные занятия боксом.',
    latitude: 55.055,
    longitude: 82.912,
    tier: 'BRONZE',
    minAge: 10,
    maxAge: 60,
  },
]

const FIRST_NAMES = [
  'Алексей',
  'Мария',
  'Иван',
  'Анна',
  'Дмитрий',
  'София',
  'Максим',
  'Елена',
  'Артём',
  'Полина',
  'Никита',
  'Дарья',
  'Михаил',
  'Ксения',
  'Роман',
  'Виктория',
]
const LAST_NAMES = [
  'Смирнов',
  'Иванова',
  'Кузнецов',
  'Попова',
  'Соколов',
  'Лебедева',
  'Козлов',
  'Новикова',
  'Морозов',
  'Волкова',
  'Петров',
  'Соловьёва',
  'Васильев',
  'Зайцева',
  'Павлов',
  'Семёнова',
]
const POSITIONS = ['GK', 'DF', 'MF', 'FW']
const FORMATS = ['FIVE_X_FIVE', 'SEVEN_X_SEVEN', 'ELEVEN_X_ELEVEN']

const ensureBaseCatalog = async () => {
  const cities = {}
  for (const name of DEMO_CITIES) {
    cities[name] = await prisma.city.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  const sports = {}
  for (const item of DEMO_SPORTS) {
    sports[item.code] = await prisma.sport.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        description: item.description,
      },
      create: item,
    })
  }
  return { cities, sports }
}

const ensureClubs = async ({ cities, sports }) => {
  const clubs = {}
  for (const item of DEMO_CLUBS) {
    const sportId = sports[item.sportCode].id
    const cityId = cities[item.city].id
    const club = await prisma.sportClub.upsert({
      where: {
        sportId_cityId_name: {
          sportId,
          cityId,
          name: item.name,
        },
      },
      update: {
        kind: item.kind,
        address: item.address,
        description: item.description,
        latitude: item.latitude,
        longitude: item.longitude,
        tier: item.tier,
        minAge: item.minAge,
        maxAge: item.maxAge,
      },
      create: {
        sportId,
        cityId,
        name: item.name,
        kind: item.kind,
        address: item.address,
        description: item.description,
        latitude: item.latitude,
        longitude: item.longitude,
        tier: item.tier,
        minAge: item.minAge,
        maxAge: item.maxAge,
        galleryUrls: [],
        coaches: [],
        contactPhone: '+7 900 000-00-00',
        contactEmail: `${item.key}@eventum.demo`,
      },
    })
    clubs[item.key] = club
  }
  return clubs
}

const ensureUsers = async ({ cities }) => {
  const passwordHash = hashPassword(DEMO_PASSWORD)
  const users = []
  for (let index = 0; index < demoUserCount; index += 1) {
    const number = String(index + 1).padStart(2, '0')
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length]
    const lastName = LAST_NAMES[index % LAST_NAMES.length]
    const username = `demo_user_${number}`
    const city = cities[DEMO_CITIES[index % DEMO_CITIES.length]]
    const user = await prisma.user.upsert({
      where: { username },
      update: {
        email: `${username}@eventum.demo`,
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        cityId: city.id,
        passwordHash,
        isBlocked: false,
        blockedUntil: null,
        blockReason: null,
      },
      create: {
        email: `${username}@eventum.demo`,
        username,
        phone: `+7999000${String(index + 1).padStart(4, '0')}`,
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        cityId: city.id,
        passwordHash,
      },
    })
    users.push(user)

    const playerCardData = {
      cityId: city.id,
      position: POSITIONS[index % POSITIONS.length],
      preferredFoot: index % 3 === 0 ? 'LEFT' : 'RIGHT',
      heightCm: 165 + (index * 3) % 28,
      weightKg: 58 + (index * 4) % 35,
      age: 18 + (index * 2) % 25,
      favoriteFormat: FORMATS[index % FORMATS.length],
      bio: 'Демо-профиль для проверки поиска игроков и команд.',
      skillTags:
        index % 2 === 0
          ? ['PACE', 'PASSING']
          : ['SHOOTING', 'STAMINA'],
      statuses:
        index % 3 === 0
          ? ['LOOKING_FOR_TEAM', 'WITHOUT_TEAM']
          : ['READY_TO_PLAY'],
      rating: 62 + (index * 3) % 32,
    }
    await prisma.playerCard.upsert({
      where: { userId: user.id },
      update: playerCardData,
      create: {
        userId: user.id,
        ...playerCardData,
      },
    })
  }
  return users
}

const ensureCoaches = async ({ users, clubs }) => {
  const coachDefinitions = [
    { userIndex: 0, clubKey: 'moscow-football', experienceYears: 9 },
    { userIndex: 1, clubKey: 'moscow-boxing', experienceYears: 7 },
    { userIndex: 2, clubKey: 'spb-fitness', experienceYears: 11 },
    { userIndex: 3, clubKey: 'nsk-fitness', experienceYears: 6 },
  ]
  const coaches = {}
  for (const definition of coachDefinitions) {
    const user = users[definition.userIndex]
    const club = clubs[definition.clubKey]
    coaches[definition.clubKey] = await prisma.coachProfile.upsert({
      where: { userId: user.id },
      update: {
        clubId: club.id,
        experienceYears: definition.experienceYears,
      },
      create: {
        userId: user.id,
        clubId: club.id,
        firstName: user.firstName,
        lastName: user.lastName,
        experienceYears: definition.experienceYears,
        description: 'Сертифицированный тренер Eventum Clubs.',
        achievements: 'Подготовил участников городских соревнований.',
      },
    })
  }
  return coaches
}

const ensureClubProducts = async ({ clubs, sports, coaches }) => {
  const schedules = {}
  const plans = {}
  let index = 0
  for (const definition of DEMO_CLUBS) {
    index += 1
    const club = clubs[definition.key]
    const coach = coaches[definition.key]
    const scheduleId = `demo-schedule-${definition.key}`
    schedules[definition.key] = await prisma.clubSchedule.upsert({
      where: { id: scheduleId },
      update: {
        clubId: club.id,
        coachProfileId: coach?.id || null,
        title: 'Открытая тренировка',
        dayOfWeek: (index % 7) + 1,
        startTime: index % 2 === 0 ? '19:00' : '18:30',
        endTime: index % 2 === 0 ? '20:30' : '20:00',
        priceCents: 70000 + index * 5000,
      },
      create: {
        id: scheduleId,
        clubId: club.id,
        coachProfileId: coach?.id || null,
        title: 'Открытая тренировка',
        dayOfWeek: (index % 7) + 1,
        startTime: index % 2 === 0 ? '19:00' : '18:30',
        endTime: index % 2 === 0 ? '20:30' : '20:00',
        ageGroup: '18+',
        coachName: coach ? `${coach.firstName} ${coach.lastName}` : 'Тренер клуба',
        priceCents: 70000 + index * 5000,
        note: 'Демо-слот, доступный для тестового бронирования.',
      },
    })

    const planId = `demo-plan-${definition.key}`
    plans[definition.key] = await prisma.membershipPlan.upsert({
      where: { id: planId },
      update: {
        sportId: sports[definition.sportCode].id,
        clubId: club.id,
        tier: definition.tier,
        title: 'Месячный абонемент',
        priceCents: 249000 + index * 10000,
        isActive: true,
      },
      create: {
        id: planId,
        sportId: sports[definition.sportCode].id,
        clubId: club.id,
        tier: definition.tier,
        title: 'Месячный абонемент',
        description: 'Безлимитное посещение клуба в течение 30 дней.',
        priceCents: 249000 + index * 10000,
        currency: 'RUB',
        durationDays: 30,
        isActive: true,
      },
    })
  }
  return { schedules, plans }
}

const ensureSocialData = async ({ users, cities }) => {
  for (let index = 1; index < Math.min(users.length, 7); index += 1) {
    const requester = users[0]
    const addressee = users[index]
    await prisma.friendship.upsert({
      where: {
        requesterId_addresseeId: {
          requesterId: requester.id,
          addresseeId: addressee.id,
        },
      },
      update: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
      create: {
        requesterId: requester.id,
        addresseeId: addressee.id,
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    })

    const [userAId, userBId] = [requester.id, addressee.id].sort()
    const chat = await prisma.directChat.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {},
      create: {
        userAId,
        userBId,
        userALastReadAt: index % 2 === 0 ? new Date() : null,
        userBLastReadAt: new Date(),
      },
    })
    const messages = [
      {
        id: `demo-message-${index}-1`,
        senderUserId: requester.id,
        text: 'Привет! Идёшь сегодня на тренировку?',
        createdAt: daysFromNow(-1, 16 + index),
      },
      {
        id: `demo-message-${index}-2`,
        senderUserId: addressee.id,
        text: index % 2 === 0 ? 'Да, буду к началу 🙌' : 'Пока не уверен, напишу позже.',
        createdAt: daysFromNow(-1, 17 + index),
      },
    ]
    for (const message of messages) {
      await prisma.chatMessage.upsert({
        where: { id: message.id },
        update: {
          chatId: chat.id,
          senderUserId: message.senderUserId,
          text: message.text,
          createdAt: message.createdAt,
        },
        create: {
          ...message,
          chatId: chat.id,
        },
      })
    }
  }

  const teamDefinitions = [
    { name: 'Demo Tigers', city: 'Москва', captainIndex: 4, memberIndexes: [4, 5, 6] },
    { name: 'Demo Neva', city: 'Санкт-Петербург', captainIndex: 1, memberIndexes: [1, 7, 10] },
  ]
  const teams = []
  for (const definition of teamDefinitions) {
    const captain = users[definition.captainIndex % users.length]
    const city = cities[definition.city]
    const team = await prisma.team.upsert({
      where: { cityId_name: { cityId: city.id, name: definition.name } },
      update: { captainUserId: captain.id },
      create: {
        name: definition.name,
        cityId: city.id,
        captainUserId: captain.id,
      },
    })
    teams.push(team)
    for (const [memberPosition, rawIndex] of definition.memberIndexes.entries()) {
      const member = users[rawIndex % users.length]
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: member.id } },
        update: {
          role: member.id === captain.id ? 'CAPTAIN' : 'MEMBER',
          fieldPosition: ['GK', 'DF', 'MF', 'FW'][memberPosition % 4],
        },
        create: {
          teamId: team.id,
          userId: member.id,
          role: member.id === captain.id ? 'CAPTAIN' : 'MEMBER',
          fieldPosition: ['GK', 'DF', 'MF', 'FW'][memberPosition % 4],
        },
      })
    }
  }
  return teams
}

const ensureContentAndActivity = async ({
  users,
  clubs,
  sports,
  cities,
  schedules,
  plans,
  teams,
}) => {
  for (const [index, definition] of DEMO_CLUBS.entries()) {
    const club = clubs[definition.key]
    const newsId = `demo-news-${definition.key}`
    const news = await prisma.news.upsert({
      where: { id: newsId },
      update: {
        clubId: club.id,
        title: `${club.name}: новости недели`,
        body: 'Новые группы уже открыты. Записывайтесь на пробную тренировку!',
      },
      create: {
        id: newsId,
        clubId: club.id,
        title: `${club.name}: новости недели`,
        body: 'Новые группы уже открыты. Записывайтесь на пробную тренировку!',
        type: index === 0 ? 'SPONSORED' : 'MANUAL',
        publishedAt: daysFromNow(-index),
      },
    })
    const user = users[index % users.length]
    await prisma.favoriteClub.upsert({
      where: { userId_clubId: { userId: user.id, clubId: club.id } },
      update: {},
      create: { userId: user.id, clubId: club.id },
    })
    await prisma.userNotification.upsert({
      where: { dedupeKey: `demo-news-notification:${news.id}:${user.id}` },
      update: {
        title: news.title,
        body: news.body,
        clubId: club.id,
        newsId: news.id,
      },
      create: {
        userId: user.id,
        type: 'FAVORITE_CLUB_NEWS',
        title: news.title,
        body: news.body,
        clubId: club.id,
        newsId: news.id,
        dedupeKey: `demo-news-notification:${news.id}:${user.id}`,
        data: { demo: true, clubId: club.id, newsId: news.id },
        readAt: index % 2 === 0 ? null : new Date(),
      },
    })
  }

  const firstClub = clubs['moscow-football']
  const firstPlan = plans['moscow-football']
  await prisma.userSubscription.upsert({
    where: { id: 'demo-subscription-active' },
    update: {
      userId: users[0].id,
      sportId: sports.FOOTBALL.id,
      clubId: firstClub.id,
      planId: firstPlan.id,
      status: 'ACTIVE',
      expiresAt: daysFromNow(24),
    },
    create: {
      id: 'demo-subscription-active',
      userId: users[0].id,
      sportId: sports.FOOTBALL.id,
      clubId: firstClub.id,
      planId: firstPlan.id,
      status: 'ACTIVE',
      startsAt: daysFromNow(-6),
      expiresAt: daysFromNow(24),
      paidAt: daysFromNow(-6),
      amountCents: firstPlan.priceCents,
      currency: 'RUB',
    },
  })

  const bookingClub = clubs['nsk-fitness']
  const bookingSchedule = schedules['nsk-fitness']
  await prisma.trainingBooking.upsert({
    where: { id: 'demo-booking-confirmed' },
    update: {
      userId: users[2].id,
      clubId: bookingClub.id,
      scheduleEntryId: bookingSchedule.id,
      scheduledAt: daysFromNow(3, 18),
      status: 'CONFIRMED',
    },
    create: {
      id: 'demo-booking-confirmed',
      userId: users[2].id,
      clubId: bookingClub.id,
      scheduleEntryId: bookingSchedule.id,
      coachProfileId: bookingSchedule.coachProfileId,
      scheduledAt: daysFromNow(3, 18),
      scheduleTitle: bookingSchedule.title || 'Открытая тренировка',
      note: 'Демо-бронирование',
      priceCents: bookingSchedule.priceCents,
      platformFeeCents: Math.round(bookingSchedule.priceCents * 0.15),
      currency: 'RUB',
      status: 'CONFIRMED',
    },
  })

  const stadium = await prisma.stadium.upsert({
    where: {
      cityId_name: {
        cityId: cities['Москва'].id,
        name: 'Demo Arena',
      },
    },
    update: {
      address: 'улица Лужники, 24',
      latitude: 55.7158,
      longitude: 37.5537,
    },
    create: {
      name: 'Demo Arena',
      address: 'улица Лужники, 24',
      description: 'Тестовый стадион Eventum.',
      latitude: 55.7158,
      longitude: 37.5537,
      cityId: cities['Москва'].id,
    },
  })
  const match = await prisma.match.upsert({
    where: { id: 'demo-match-open' },
    update: {
      stadiumId: stadium.id,
      startTime: daysFromNow(5, 17),
      endTime: daysFromNow(5, 19),
      status: 'OPEN',
    },
    create: {
      id: 'demo-match-open',
      stadiumId: stadium.id,
      startTime: daysFromNow(5, 17),
      endTime: daysFromNow(5, 19),
      format: 'FIVE_X_FIVE',
      maxTeams: 4,
      priceCents: 300000,
      currency: 'RUB',
      status: 'OPEN',
      approvalMode: 'AUTO_FIRST_COME',
      description: 'Открытый демо-матч для проверки регистрации.',
    },
  })
  if (teams[0]) {
    await prisma.matchRegistration.upsert({
      where: {
        matchId_teamName: {
          matchId: match.id,
          teamName: teams[0].name,
        },
      },
      update: {
        teamId: teams[0].id,
        status: 'APPROVED',
      },
      create: {
        matchId: match.id,
        teamId: teams[0].id,
        teamName: teams[0].name,
        captainName: users[4].name,
        captainLogin: users[4].username,
        cityId: cities['Москва'].id,
        stadiumId: stadium.id,
        playersCount: 5,
        status: 'APPROVED',
        note: 'Демо-регистрация',
      },
    })
  }
}

const ensureWellnessAndWorkout = async ({ users }) => {
  const stories = [
    {
      slug: 'demo-recovery-after-training',
      title: 'Восстановление после тренировки',
      body: 'Пейте воду, сделайте лёгкую заминку и уделите время качественному сну.',
      category: 'ROUTINE',
      sortOrder: 10,
    },
    {
      slug: 'demo-pre-game-nutrition',
      title: 'Питание перед игрой',
      body: 'Выбирайте знакомую лёгкую еду за два-три часа до нагрузки.',
      category: 'NUTRITION',
      sortOrder: 20,
    },
  ]
  for (const story of stories) {
    await prisma.wellnessStory.upsert({
      where: { slug: story.slug },
      update: story,
      create: {
        ...story,
        locale: 'ru',
        readMinutes: 3,
        isActive: true,
      },
    })
  }

  const program = await prisma.workoutProgram.upsert({
    where: { id: 'demo-functional-start' },
    update: {
      title: 'Функциональный старт',
      description: 'Короткая тренировка для знакомства с таймером.',
      isActive: true,
    },
    create: {
      id: 'demo-functional-start',
      title: 'Функциональный старт',
      subtitle: '15 минут',
      description: 'Короткая тренировка для знакомства с таймером.',
      guide: 'Выполняйте упражнения в комфортном темпе.',
      iconKey: 'fitness_center',
      gradientStart: '#FF7A00',
      gradientEnd: '#FFB800',
      estimatedMinutes: 15,
      sortOrder: 10,
      isActive: true,
      locale: 'ru',
    },
  })
  const steps = [
    ['WARMUP', 'Разминка', 180],
    ['WORK', 'Приседания', 240],
    ['REST', 'Отдых', 60],
    ['WORK', 'Планка', 180],
    ['COOLDOWN', 'Заминка', 180],
  ]
  for (const [index, [phase, title, durationSeconds]] of steps.entries()) {
    await prisma.workoutStep.upsert({
      where: {
        programId_order: {
          programId: program.id,
          order: index + 1,
        },
      },
      update: { phase, title, durationSeconds },
      create: {
        programId: program.id,
        order: index + 1,
        phase,
        title,
        description: 'Демо-шаг программы тренировок.',
        durationSeconds,
      },
    })
  }
  await prisma.workoutSession.upsert({
    where: {
      userId_clientKey: {
        userId: users[0].id,
        clientKey: 'demo-seed-session',
      },
    },
    update: {
      programId: program.id,
      finishedAt: daysFromNow(-1, 19),
      durationSeconds: 840,
    },
    create: {
      userId: users[0].id,
      programId: program.id,
      startedAt: daysFromNow(-1, 18),
      finishedAt: daysFromNow(-1, 19),
      durationSeconds: 840,
      source: 'TIMER',
      clientKey: 'demo-seed-session',
    },
  })
}

const main = async () => {
  if (
    process.env.TEST_DATABASE_URL &&
    process.env.DATABASE_URL === process.env.TEST_DATABASE_URL &&
    process.env.ALLOW_TEST_DEMO_SEED !== 'true'
  ) {
    throw new Error(
      'Refusing to persist demo data in TEST_DATABASE_URL. Set ALLOW_TEST_DEMO_SEED=true only when intentional.',
    )
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PRODUCTION_DEMO_SEED !== 'true'
  ) {
    throw new Error(
      'Demo seed is disabled in production. Set ALLOW_PRODUCTION_DEMO_SEED=true only for an intentional demo environment.',
    )
  }

  console.log(`Creating Eventum demo dataset (${demoUserCount} users)...`)
  const catalog = await ensureBaseCatalog()
  const clubs = await ensureClubs(catalog)
  const users = await ensureUsers(catalog)
  const coaches = await ensureCoaches({ users, clubs })
  const products = await ensureClubProducts({
    clubs,
    sports: catalog.sports,
    coaches,
  })
  const teams = await ensureSocialData({
    users,
    cities: catalog.cities,
  })
  await ensureContentAndActivity({
    users,
    clubs,
    sports: catalog.sports,
    cities: catalog.cities,
    schedules: products.schedules,
    plans: products.plans,
    teams,
  })
  await ensureWellnessAndWorkout({ users })

  console.log('')
  console.log('Demo data is ready.')
  console.log(`Users: ${users.length}; clubs: ${Object.keys(clubs).length}; teams: ${teams.length}`)
  console.log(`Login: demo_user_01 / ${DEMO_PASSWORD}`)
  console.log('Run the same command again safely: demo records will be updated, not duplicated.')
}

main()
  .catch((error) => {
    console.error('Demo seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

export const normalizeSportCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')

export const toNullableInt = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

export const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const normalizeCoaches = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export const normalizeStringList = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
  }

  return [
    ...new Set(
      String(value || '')
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
}

export const normalizeMediaUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/uploads/')) return raw

  try {
    const parsed = new URL(raw)
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  } catch {
    return raw.startsWith('uploads/') ? `/${raw}` : raw
  }

  return raw
}

export const normalizeClubTier = (value, nullable = false) => {
  const tier = String(value || '').trim().toUpperCase()
  if (!tier && nullable) return null
  return ['BRONZE', 'SILVER', 'GOLD'].includes(tier) ? tier : null
}

export const normalizeSchedules = (value) => {
  const raw = Array.isArray(value) ? value : []
  return raw
    .map((item) => ({
      id: String(item.id || '').trim() || undefined,
      title: String(item.title || '').trim() || null,
      dayOfWeek: toNullableInt(item.dayOfWeek),
      startTime: String(item.startTime || '').trim(),
      endTime: String(item.endTime || '').trim(),
      ageGroup: String(item.ageGroup || '').trim() || null,
      coachName: String(item.coachName || '').trim() || null,
      coachProfileId:
        String(item.coachProfileId || item.coachId || '').trim() || null,
      priceCents: toNullableInt(item.priceCents),
      note: String(item.note || '').trim() || null,
    }))
    .filter((item) => item.startTime && item.endTime)
}

export const serializeSport = (sport) => ({
  id: sport.id,
  code: sport.code,
  name: sport.name,
  description: sport.description || '',
  createdAt: sport.createdAt,
  updatedAt: sport.updatedAt,
})

export const serializeCoachProfile = (profile, options = {}) => {
  const includeClub = options.includeClub !== false

  return {
    id: profile.id,
    userId: profile.userId,
    clubId: profile.clubId || '',
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.user?.phone || '',
    experienceYears: profile.experienceYears,
    description: profile.description || profile.achievements || '',
    achievements: profile.achievements || profile.description || '',
    photoUrl: normalizeMediaUrl(profile.photoUrl),
    maxUrl: profile.maxUrl || '',
    telegramUrl: profile.telegramUrl || '',
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    user: profile.user
      ? {
          id: profile.user.id,
          email: profile.user.email,
          username: profile.user.username || '',
          phone: profile.user.phone || '',
          firstName: profile.user.firstName || '',
          lastName: profile.user.lastName || '',
        }
      : null,
    club:
      includeClub && profile.club
        ? {
            id: profile.club.id,
            name: profile.club.name,
            city: profile.club.city?.name || '',
            sport: profile.club.sport ? serializeSport(profile.club.sport) : null,
          }
        : null,
  }
}

export const serializeClub = (club) => ({
  id: club.id,
  sportId: club.sportId,
  sport: club.sport ? serializeSport(club.sport) : null,
  cityId: club.cityId || '',
  city: club.city?.name || '',
  name: club.name,
  kind: club.kind || '',
  address: club.address,
  description: club.description || '',
  latitude: club.latitude,
  longitude: club.longitude,
  tier: club.tier,
  imageUrl: normalizeMediaUrl(club.imageUrl || club.logoUrl),
  logoUrl: normalizeMediaUrl(club.logoUrl || club.imageUrl),
  galleryUrls: (club.galleryUrls || []).map(normalizeMediaUrl),
  imageUrls: (club.galleryUrls || []).map(normalizeMediaUrl),
  yandexMapsUrl: club.yandexMapsUrl || '',
  contactPhone: club.contactPhone || '',
  contactEmail: club.contactEmail || '',
  websiteUrl: club.websiteUrl || '',
  telegramUrl: club.telegramUrl || '',
  vkUrl: club.vkUrl || '',
  instagramUrl: club.instagramUrl || '',
  minAge: club.minAge,
  maxAge: club.maxAge,
  coaches: club.coaches || [],
  coachProfiles: (club.coachProfiles || []).map((profile) =>
    serializeCoachProfile(profile, { includeClub: false }),
  ),
  schedules: (club.schedules || []).map((schedule) => ({
    id: schedule.id,
    title: schedule.title || '',
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    ageGroup: schedule.ageGroup || '',
    coachName: schedule.coachName || '',
    coachProfileId: schedule.coachProfileId || '',
    coachId: schedule.coachProfileId || '',
    priceCents: schedule.priceCents,
    note: schedule.note || '',
  })),
  passes: (club.plans || []).map((plan) => ({
    id: plan.id,
    clubId: plan.clubId || '',
    sportId: plan.sportId,
    title: plan.title,
    description: plan.description || '',
    tier: plan.tier,
    priceCents: plan.priceCents,
    currency: plan.currency,
    durationDays: plan.durationDays,
    isActive: Boolean(plan.isActive),
  })),
  subscriptions: (club.plans || []).map((plan) => ({
    id: plan.id,
    title: plan.title,
    tier: plan.tier,
    priceCents: plan.priceCents,
    currency: plan.currency,
    durationDays: plan.durationDays,
    isActive: Boolean(plan.isActive),
  })),
  createdAt: club.createdAt,
  updatedAt: club.updatedAt,
})

export const serializePlan = (plan) => ({
  id: plan.id,
  sportId: plan.sportId,
  sport: plan.sport ? serializeSport(plan.sport) : null,
  clubId: plan.clubId || '',
  tier: plan.tier,
  club: plan.club
    ? {
        id: plan.club.id,
        name: plan.club.name,
        city: plan.club.city?.name || '',
        address: plan.club.address,
      }
    : null,
  title: plan.title,
  description: plan.description || '',
  priceCents: plan.priceCents,
  currency: plan.currency,
  durationDays: plan.durationDays,
  isActive: Boolean(plan.isActive),
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
})

export const serializeSubscription = (subscription) => ({
  id: subscription.id,
  userId: subscription.userId,
  user: subscription.user
    ? {
        id: subscription.user.id,
        email: subscription.user.email,
        username: subscription.user.username || '',
        name: subscription.user.name || '',
        firstName: subscription.user.firstName || '',
        lastName: subscription.user.lastName || '',
      }
    : null,
  sportId: subscription.sportId,
  sport: subscription.sport ? serializeSport(subscription.sport) : null,
  clubId: subscription.clubId || '',
  club: subscription.club
    ? {
        id: subscription.club.id,
        name: subscription.club.name,
        city: subscription.club.city?.name || '',
        address: subscription.club.address,
      }
    : null,
  planId: subscription.planId,
  passId: subscription.planId,
  plan: subscription.plan ? serializePlan(subscription.plan) : null,
  title: subscription.plan?.title || '',
  planTitle: subscription.plan?.title || '',
  sportName: subscription.sport?.name || '',
  clubName: subscription.club?.name || '',
  durationDays: subscription.plan?.durationDays || 0,
  status: subscription.status,
  startsAt: subscription.startsAt,
  expiresAt: subscription.expiresAt,
  paidAt: subscription.paidAt,
  amountCents: subscription.amountCents,
  currency: subscription.currency,
  createdAt: subscription.createdAt,
  updatedAt: subscription.updatedAt,
})

export const clubInclude = {
  sport: true,
  city: true,
  coachProfiles: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ experienceYears: 'desc' }, { createdAt: 'asc' }],
  },
  schedules: {
    include: {
      coachProfile: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  },
  plans: {
    where: { isActive: true },
    orderBy: [{ priceCents: 'asc' }, { createdAt: 'asc' }],
  },
}

export const coachProfileInclude = {
  user: {
    select: {
      id: true,
      email: true,
      username: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  },
  club: {
    include: {
      city: true,
      sport: true,
    },
  },
}

export const favoriteClubInclude = {
  club: {
    include: clubInclude,
  },
}

export const planInclude = {
  sport: true,
  club: { include: { city: true } },
}

export const subscriptionInclude = {
  user: true,
  sport: true,
  club: { include: { city: true } },
  plan: { include: planInclude },
}

export type City = {
  id: string
  name: string
}

export type Stadium = {
  id: string
  name: string
  address: string
  description?: string | null
  latitude: number | string
  longitude: number | string
  imageUrl?: string | null
  cityId: string
  city?: City
}

export type Match = {
  id: string
  stadiumId: string
  startTime: string
  endTime: string
  format: 'FIVE_X_FIVE' | 'SEVEN_X_SEVEN' | 'ELEVEN_X_ELEVEN'
  maxTeams: number
  priceCents?: number | null
  currency?: string | null
  status: 'DRAFT' | 'OPEN' | 'FULL' | 'FINISHED' | 'CANCELLED'
  approvalMode: 'MANUAL' | 'AUTO_FIRST_COME'
  description?: string | null
  stadium?: Stadium & { city?: City }
  registrations?: MatchRegistration[]
}

export type User = {
  id: string
  email: string
  username?: string | null
  name: string
  firstName?: string | null
  lastName?: string | null
  role: 'ADMIN' | 'USER'
  cityId?: string | null
  city?: City | null
  isBlocked?: boolean
  blockReason?: string | null
  blockedUntil?: string | null
  matchBanUntil?: string | null
  referralCode?: string | null
  premiumSubscriptions?: Array<{ expiresAt: string }>
  _count?: { referralRedemptions: number }
  createdAt?: string
  updatedAt?: string
  memberships?: TeamMember[]
  captainedTeams?: Team[]
}

export type Team = {
  id: string
  name: string
  cityId: string
  captainUserId: string
  city?: City
  captain?: User
  members?: TeamMember[]
}

export type TeamMember = {
  id: string
  teamId: string
  userId: string
  role: 'CAPTAIN' | 'MEMBER'
  user?: User
}

export type MatchRegistration = {
  id: string
  matchId: string
  teamId?: string | null
  teamName: string
  captainName: string
  captainLogin: string
  cityId: string
  stadiumId: string
  playersCount?: number | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  note?: string | null
  team?: Team
  match?: Match
  createdAt: string
}

export type NewsItem = {
  id: string
  title: string
  body: string
  imageUrl?: string | null
  type: 'news' | 'sponsored' | 'STADIUM_CREATED' | 'MATCH_CREATED'
  clubId?: string
  stadiumId?: string
  matchId?: string
  viewCount: number
  uniqueViewerCount: number
  publishedAt: string
  createdAt?: string
  updatedAt?: string
  club?: {
    id: string
    name: string
    city?: string
    sport?: Sport | null
  } | null
  stadium?: {
    id: string
    name: string
    city?: string
  } | null
  match?: {
    id: string
    startTime: string
    status: string
    format: string
    stadium?: {
      id: string
      name: string
      city?: string
    } | null
  } | null
}

export type WellnessStoryCategory =
  | 'nutrition'
  | 'warmup'
  | 'routine'
  | 'workouts'
  | 'balance'

export type WellnessStory = {
  id: string
  slug?: string | null
  title: string
  body: string
  category: WellnessStoryCategory
  coverImageUrl?: string | null
  readMinutes: number
  sortOrder: number
  locale: 'ru'
  publishedAt: string
  isActive: boolean
  uniqueViewerCount: number
  viewedByMe?: boolean
  authorType?: 'platform' | 'coach' | 'club'
  authorClubId?: string | null
  authorUserId?: string | null
  coachProfileId?: string | null
  deletedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export type WorkoutPhase = 'warmup' | 'work' | 'rest' | 'cooldown'

export type WorkoutStep = {
  id: string
  programId: string
  order: number
  phase: WorkoutPhase
  title: string
  description?: string | null
  durationSeconds: number
  illustrationUrl?: string | null
  poseIndex?: number | null
}

export type WorkoutProgram = {
  id: string
  title: string
  subtitle?: string | null
  description: string
  guide?: string | null
  iconKey?: string | null
  gradientStart?: string | null
  gradientEnd?: string | null
  estimatedMinutes?: number | null
  sortOrder: number
  locale: 'ru'
  isActive: boolean
  stepCount: number
  totalDurationSeconds: number
  uniqueViewerCount: number
  viewedByMe?: boolean
  steps?: WorkoutStep[]
  createdAt?: string
  updatedAt?: string
}

export type Sport = {
  id: string
  code: string
  name: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export type ClubTier = 'BRONZE' | 'SILVER' | 'GOLD'

export type ClubSchedule = {
  id?: string
  title?: string
  dayOfWeek?: number | null
  startTime: string
  endTime: string
  ageGroup?: string
  coachName?: string
  coachProfileId?: string
  coachId?: string
  priceCents: number
  note?: string
}

export type CoachProfile = {
  id: string
  userId: string
  clubId: string
  firstName: string
  lastName: string
  experienceYears?: number | null
  achievements?: string
  photoUrl?: string
  createdAt?: string
  updatedAt?: string
  user?: {
    id: string
    email?: string
    username?: string
    firstName?: string
    lastName?: string
  } | null
}

export type SportClub = {
  id: string
  sportId: string
  sport?: Sport | null
  cityId?: string
  city?: string
  name: string
  kind?: string
  address: string
  description?: string
  latitude?: number | string | null
  longitude?: number | string | null
  tier: ClubTier
  imageUrl?: string
  logoUrl?: string
  galleryUrls: string[]
  imageUrls?: string[]
  yandexMapsUrl?: string
  contactPhone?: string
  contactEmail?: string
  websiteUrl?: string
  telegramUrl?: string
  vkUrl?: string
  instagramUrl?: string
  minAge?: number | null
  maxAge?: number | null
  coaches: string[]
  coachProfiles: CoachProfile[]
  schedules: ClubSchedule[]
  passes?: MembershipPlan[]
  subscriptions?: MembershipPlan[]
  createdAt?: string
  updatedAt?: string
}

export type MembershipPlan = {
  id: string
  sportId: string
  sport?: Sport | null
  clubId?: string
  tier?: ClubTier | null
  club?: {
    id: string
    name: string
    city?: string
    address?: string
  } | null
  title: string
  description?: string
  priceCents: number
  currency: string
  durationDays: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type TrainingBookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'

export type TrainingBooking = {
  id: string
  userId: string
  user?: Pick<User, 'id' | 'email' | 'username' | 'name'> | null
  clubId: string
  clubName: string
  club?: Pick<SportClub, 'id' | 'name' | 'address' | 'tier' | 'logoUrl'> | null
  scheduleEntryId: string
  scheduleId: string
  coachProfileId: string
  coachId: string
  scheduledAt: string
  scheduleTitle: string
  note?: string
  priceCents: number
  platformFeeCents: number
  currency: string
  status: TrainingBookingStatus
  createdAt: string
  updatedAt: string
}

export type UserSubscription = {
  id: string
  userId: string
  user?: User | null
  sportId: string
  sport?: Sport | null
  clubId?: string
  club?: {
    id: string
    name: string
    city?: string
    address?: string
  } | null
  planId?: string | null
  plan?: MembershipPlan | null
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
  startsAt: string
  expiresAt: string
  paidAt?: string | null
  amountCents: number
  currency: string
  createdAt?: string
  updatedAt?: string
}

export type Payment = {
  id: string
  orderId: string
  provider: string
  externalId: string
  status: 'PENDING' | 'SUCCEEDED' | 'CANCELLED' | 'FAILED'
  amountCents: number
  currency: string
  confirmationUrl: string
  paidAt?: string | null
}

export type Order = {
  id: string
  userId: string
  user?: Pick<User, 'id' | 'email' | 'username' | 'name'> | null
  planId: string
  passId: string
  plan?: { id: string; title: string; sportId: string } | null
  premiumPlanId?: string
  premiumPlan?: { id: string; code: string; title: string } | null
  clubId: string
  club?: { id: string; name: string } | null
  type: 'MEMBERSHIP' | 'PREMIUM' | 'TRIAL'
  status: 'PENDING' | 'PAYMENT_CREATED' | 'PAID' | 'CANCELLED' | 'FAILED'
  amountCents: number
  currency: string
  durationDays: number
  payment?: Payment | null
  subscriptionId: string
  paidAt?: string | null
  createdAt: string
  updatedAt: string
}

export type AppPremiumPlan = {
  id: string
  code: string
  title: string
  description?: string | null
  priceCents: number
  currency: string
  durationDays: number
  isActive: boolean
}

export type AppPremiumSubscription = {
  id: string
  userId: string
  user?: Pick<User, 'id' | 'email' | 'username' | 'name'> | null
  planId: string
  plan: AppPremiumPlan
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
  startsAt: string
  expiresAt: string
  paidAt: string
  amountCents: number
  currency: string
  order?: { id: string; status: string; paidAt?: string | null } | null
}

export type PremiumAdminOverview = {
  plans: AppPremiumPlan[]
  subscriptions: AppPremiumSubscription[]
}

export type CrmClientStatus = 'NEW' | 'ACTIVE' | 'VIP' | 'AT_RISK' | 'NEEDS_ATTENTION' | 'BLOCKED'

export type CrmActivityItem = {
  id: string
  type: string
  title: string
  meta?: string
  at: string
}

export type CrmClient = {
  id: string
  name: string
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  email: string
  phone?: string | null
  city?: City | null
  role: 'ADMIN' | 'USER'
  isBlocked?: boolean
  blockedUntil?: string | null
  matchBanUntil?: string | null
  createdAt: string
  updatedAt: string
  status: CrmClientStatus
  segments: string[]
  nextAction: string
  lastActivityAt?: string | null
  stats: {
    registrations: number
    pendingRegistrations: number
    approvedRegistrations: number
    rejectedRegistrations: number
    teams: number
    captainedTeams: number
    subscriptions: number
    activeSubscriptions: number
    favoriteClubs: number
  }
  registrations: MatchRegistration[]
  subscriptions: UserSubscription[]
  favoriteClubs: Array<{
    id: string
    createdAt: string
    club?: SportClub | null
  }>
  activity: CrmActivityItem[]
}

export type CrmCoach = {
  id: string
  userId: string
  name: string
  phone?: string
  email?: string
  username?: string
  experienceYears?: number | null
  description?: string
  achievements?: string
  photoUrl?: string
  telegramUrl?: string
  club?: {
    id: string
    name: string
    kind?: string
    city?: string
    sport?: Sport | null
  } | null
  stats: {
    activeStudents: number
    totalStudents: number
    prospects: number
    chats: number
  }
}

export type CrmClub = {
  id: string
  name: string
  kind?: string
  city?: string
  address: string
  description?: string
  imageUrl?: string
  contactPhone?: string
  contactEmail?: string
  websiteUrl?: string
  telegramUrl?: string
  vkUrl?: string
  instagramUrl?: string
  sport?: Sport | null
  nextAction: string
  stats: {
    coaches: number
    schedules: number
    plans: number
    activePlans: number
    subscriptions: number
    activeSubscriptions: number
    expiringSubscriptions: number
    favoriteUsers: number
    revenue: {
      amountCents: number
      currency: string
    }
  }
  coaches: Array<{
    id: string
    name: string
    phone?: string
  }>
  schedules: Array<{
    id: string
    title?: string
    dayOfWeek?: number | null
    startTime: string
    endTime: string
    ageGroup?: string
    coachName?: string
  }>
}

export type CrmOverview = {
  sports: Array<{
    code: string
    name: string
  }>
  selectedSportCode: string
  sportBreakdown: Array<{
    code: string
    name: string
    clients: number
    pendingRegistrations: number
    activeSubscriptions: number
    coaches: number
    clubs: number
  }>
  summary: {
    clientsTotal: number
    newClientsWeek: number
    activeClientsMonth: number
    pendingRegistrations: number
    activeSubscriptions: number
    expiringSubscriptions: number
    revenue: {
      amountCents: number
      currency: string
    }
    matchesNeedTeams: number
    coaches: number
    clubs: number
  }
  attention: {
    pendingRegistrations: MatchRegistration[]
    expiringSubscriptions: UserSubscription[]
    matchesNeedTeams: Array<Match & { approvedTeams: number; emptySlots: number }>
  }
  clubs: CrmClub[]
  coaches: CrmCoach[]
  clients: CrmClient[]
}

export type WorkoutAnalytics = {
  range: { from: string; to: string; maxDays: number }
  metrics: {
    sessions: number
    users: number
    durationSeconds: number
    averageDurationSeconds: number
  }
  popularPrograms: Array<{
    programId: string
    title: string
    locale?: string | null
    isActive: boolean
    sessions: number
    durationSeconds: number
  }>
}

export type PushTargetSegment = 'ALL_USERS' | 'SELECTED_USERS' | 'FAVORITE_CLUB'
export type PushCampaignStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'PARTIAL' | 'FAILED' | 'SKIPPED'

export type PushTemplate = {
  id: string
  name: string
  title: string
  body: string
  imageUrl?: string | null
  data?: Record<string, unknown> | null
}

export type PushCampaign = PushTemplate & {
  status: PushCampaignStatus
  targetSegment: PushTargetSegment
  selectedUserIds: string[]
  favoriteClubId?: string | null
  favoriteClub?: { id: string; name: string } | null
  recipientCount: number
  inAppCreatedCount: number
  pushSentCount: number
  pushFailedCount: number
  pushSkippedCount: number
  lastError?: string | null
  createdAt: string
  sentAt?: string | null
}

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED'
export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export type SupportMessage = {
  id: string
  authorType: 'USER' | 'ADMIN'
  body: string
  isInternal: boolean
  createdAt: string
}

export type SupportTicket = {
  id: string
  subject: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  user: Pick<User, 'id' | 'email' | 'username' | 'name'>
  messages?: SupportMessage[]
  _count?: { messages: number }
  createdAt: string
  updatedAt: string
}

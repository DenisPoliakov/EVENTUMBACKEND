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
  type: 'MANUAL' | 'STADIUM_CREATED' | 'MATCH_CREATED'
  stadiumId?: string
  matchId?: string
  publishedAt: string
  createdAt?: string
  updatedAt?: string
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

export type Sport = {
  id: string
  code: string
  name: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export type ClubSchedule = {
  id?: string
  title?: string
  dayOfWeek?: number | null
  startTime: string
  endTime: string
  ageGroup?: string
  coachName?: string
  note?: string
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
  imageUrl?: string
  yandexMapsUrl?: string
  minAge?: number | null
  maxAge?: number | null
  coaches: string[]
  schedules: ClubSchedule[]
  createdAt?: string
  updatedAt?: string
}

export type MembershipPlan = {
  id: string
  sportId: string
  sport?: Sport | null
  clubId?: string
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
  planId: string
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

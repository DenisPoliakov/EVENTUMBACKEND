import { normalizeMediaUrl } from './ecosystem.js'

export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
]

export const bookingInclude = {
  user: {
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      firstName: true,
      lastName: true,
    },
  },
  club: {
    select: {
      id: true,
      name: true,
      address: true,
      imageUrl: true,
      logoUrl: true,
      tier: true,
    },
  },
  scheduleEntry: {
    select: {
      id: true,
      title: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      priceCents: true,
    },
  },
  coachProfile: {
    include: {
      user: {
        select: { id: true, email: true, username: true, phone: true },
      },
    },
  },
}

export const serializeBooking = (booking) => ({
  id: booking.id,
  userId: booking.userId,
  user: booking.user
    ? {
        id: booking.user.id,
        email: booking.user.email,
        username: booking.user.username || '',
        name:
          booking.user.name ||
          [booking.user.firstName, booking.user.lastName].filter(Boolean).join(' '),
      }
    : null,
  clubId: booking.clubId,
  clubName: booking.club?.name || '',
  club: booking.club
    ? {
        id: booking.club.id,
        name: booking.club.name,
        address: booking.club.address,
        tier: booking.club.tier,
        logoUrl: normalizeMediaUrl(
          booking.club.logoUrl || booking.club.imageUrl,
        ),
      }
    : null,
  scheduleEntryId: booking.scheduleEntryId || '',
  scheduleId: booking.scheduleEntryId || '',
  schedule: booking.scheduleEntry || null,
  coachProfileId: booking.coachProfileId || '',
  coachId: booking.coachProfileId || '',
  coach: booking.coachProfile
    ? {
        id: booking.coachProfile.id,
        userId: booking.coachProfile.userId,
        firstName: booking.coachProfile.firstName,
        lastName: booking.coachProfile.lastName,
        photoUrl: normalizeMediaUrl(booking.coachProfile.photoUrl),
      }
    : null,
  scheduledAt: booking.scheduledAt,
  scheduleTitle: booking.scheduleTitle,
  note: booking.note || '',
  priceCents: booking.priceCents,
  platformFeeCents: booking.platformFeeCents,
  currency: booking.currency,
  status: booking.status,
  createdAt: booking.createdAt,
  updatedAt: booking.updatedAt,
})

export const hasActiveUserBlock = (user, now = new Date()) => {
  if (!user?.isBlocked) return false
  return !user.blockedUntil || new Date(user.blockedUntil) > now
}

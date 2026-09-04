import prisma from '../prisma.js'

const VISIBILITY = new Set(['PUBLIC', 'FRIENDS', 'PRIVATE'])

export const parseProfileVisibility = (value, fallback = 'PUBLIC') => {
  if (value === undefined || value === null || value === '') return fallback
  const normalized = String(value).trim().toUpperCase()
  if (!VISIBILITY.has(normalized)) {
    const error = new Error('profileVisibility must be PUBLIC, FRIENDS, or PRIVATE')
    error.statusCode = 400
    throw error
  }
  return normalized
}

export const parseHideFlag = (value, fallback = false) => {
  if (value === undefined) return fallback
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  const error = new Error('hide* flags must be boolean')
  error.statusCode = 400
  throw error
}

export const privacySettingsFromUser = (user) => ({
  profileVisibility: user.profileVisibility || 'PUBLIC',
  hideEmail: Boolean(user.hideEmail),
  hidePhone: Boolean(user.hidePhone),
  hideBirthDate: Boolean(user.hideBirthDate),
  hideCity: Boolean(user.hideCity),
  hideCoachContacts: Boolean(user.hideCoachContacts),
})

export const canViewProfileDetails = ({ visibility, isSelf, isFriend }) => {
  if (isSelf) return true
  if (visibility === 'PRIVATE') return false
  if (visibility === 'FRIENDS') return Boolean(isFriend)
  return true
}

export const redactUserForViewer = (user, { isSelf = false, isFriend = false } = {}) => {
  if (!user) return null
  const privacy = privacySettingsFromUser(user)
  const canSee = canViewProfileDetails({
    visibility: privacy.profileVisibility,
    isSelf,
    isFriend,
  })

  // Фото для чатов/аватаров: тренерское фото или обычный аватар.
  // Не прячем в чате — иначе WS-обновление «сбрасывает» картинку у клиента.
  const displayPhoto =
    user.coachProfile?.photoUrl ||
    user.avatarUrl ||
    user.playerCard?.avatarUrl ||
    ''

  const base = {
    id: user.id,
    username: user.username || '',
    firstName: canSee ? user.firstName || '' : '',
    lastName: canSee ? user.lastName || '' : '',
    avatarUrl: displayPhoto,
    photoUrl: displayPhoto,
    isCoach: Boolean(user.coachProfile),
    profileVisibility: privacy.profileVisibility,
  }

  if (!canSee) {
    return {
      ...base,
      email: '',
      phone: '',
      birthDate: null,
      city: '',
      coachProfile: user.coachProfile
        ? {
            id: user.coachProfile.id,
            firstName: user.coachProfile.firstName,
            lastName: user.coachProfile.lastName,
            photoUrl: user.coachProfile.photoUrl || displayPhoto || '',
            club: user.coachProfile.club
              ? {
                  id: user.coachProfile.club.id,
                  name: user.coachProfile.club.name,
                  city: '',
                  sport: user.coachProfile.club.sport
                    ? {
                        id: user.coachProfile.club.sport.id,
                        code: user.coachProfile.club.sport.code,
                        name: user.coachProfile.club.sport.name,
                      }
                    : null,
                }
              : null,
            maxUrl: '',
            telegramUrl: '',
            experienceYears: user.coachProfile.experienceYears,
          }
        : null,
      privacy: {
        limited: true,
        reason:
          privacy.profileVisibility === 'PRIVATE'
            ? 'profile_private'
            : 'friends_only',
      },
    }
  }

  const hideCoach = privacy.hideCoachContacts && !isSelf
  const coach = user.coachProfile
    ? {
        id: user.coachProfile.id,
        clubId: user.coachProfile.clubId || '',
        firstName: user.coachProfile.firstName,
        lastName: user.coachProfile.lastName,
        experienceYears: user.coachProfile.experienceYears,
        photoUrl: user.coachProfile.photoUrl || displayPhoto || '',
        maxUrl: hideCoach ? '' : user.coachProfile.maxUrl || '',
        telegramUrl: hideCoach ? '' : user.coachProfile.telegramUrl || '',
        club: user.coachProfile.club
          ? {
              id: user.coachProfile.club.id,
              name: user.coachProfile.club.name,
              city:
                privacy.hideCity && !isSelf
                  ? ''
                  : user.coachProfile.club.city?.name || '',
              sport: user.coachProfile.club.sport
                ? {
                    id: user.coachProfile.club.sport.id,
                    code: user.coachProfile.club.sport.code,
                    name: user.coachProfile.club.sport.name,
                  }
                : null,
            }
          : null,
      }
    : null

  return {
    ...base,
    email: privacy.hideEmail && !isSelf ? '' : user.email || '',
    phone: privacy.hidePhone && !isSelf ? '' : user.phone || '',
    birthDate:
      privacy.hideBirthDate && !isSelf
        ? null
        : user.birthDate
          ? new Date(user.birthDate).toISOString().slice(0, 10)
          : null,
    city: privacy.hideCity && !isSelf ? '' : user.city?.name || '',
    coachProfile: coach,
    privacy: {
      limited: false,
      ...privacy,
    },
  }
}

export const resolveFriendshipFlag = async (viewerId, targetUserId) => {
  if (!viewerId || !targetUserId) {
    return { isSelf: false, isFriend: false }
  }
  if (viewerId === targetUserId) {
    return { isSelf: true, isFriend: false }
  }
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: viewerId, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: viewerId },
      ],
    },
    select: { id: true },
  })
  return { isSelf: false, isFriend: Boolean(friendship) }
}

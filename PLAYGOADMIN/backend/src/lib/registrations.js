import prisma from '../prisma.js'
import { generateUsername, splitName } from './auth.js'

const ACTIVE_REGISTRATION_STATUSES = ['PENDING', 'APPROVED']

export const ensureTeamForRegistration = async (registration) => {
  if (registration.teamId) return registration.teamId

  let captain = await prisma.user.findFirst({
    where: {
      OR: [
        { email: registration.captainLogin },
        { username: registration.captainLogin },
      ],
    },
  })

  if (!captain) {
    const parsedName = splitName(registration.captainName)
    captain = await prisma.user.create({
      data: {
        email: registration.captainLogin,
        name: registration.captainName,
        username: generateUsername(registration.captainLogin),
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        passwordHash: 'N/A',
        role: 'USER',
        cityId: registration.cityId,
      },
    })
  }

  let team = await prisma.team.findFirst({
    where: { name: registration.teamName, cityId: registration.cityId },
  })
  if (!team) {
    team = await prisma.team.create({
      data: {
        name: registration.teamName,
        cityId: registration.cityId,
        captainUserId: captain.id,
        members: { create: { userId: captain.id, role: 'CAPTAIN' } },
      },
    })
  }

  await prisma.matchRegistration.update({
    where: { id: registration.id },
    data: { teamId: team.id },
  })

  return team.id
}

export const syncMatchStatusByCapacity = async (matchId) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      registrations: {
        where: { status: 'APPROVED' },
      },
    },
  })
  if (!match) return null

  const approvedCount = match.registrations.length
  const isFull = approvedCount >= match.maxTeams

  if (match.status === 'OPEN' && isFull) {
    await prisma.match.update({
      where: { id: match.id },
      data: { status: 'FULL' },
    })
  } else if (match.status === 'FULL' && !isFull) {
    await prisma.match.update({
      where: { id: match.id },
      data: { status: 'OPEN' },
    })
  }

  return { ...match, approvedCount }
}

export const promotePendingRegistrations = async (matchId) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      registrations: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!match) return

  if (match.approvalMode !== 'AUTO_FIRST_COME') {
    await syncMatchStatusByCapacity(matchId)
    return
  }

  const approvedCount = match.registrations.filter(
    (registration) => registration.status === 'APPROVED'
  ).length
  const freeSlots = Math.max(match.maxTeams - approvedCount, 0)
  if (freeSlots <= 0) {
    await syncMatchStatusByCapacity(matchId)
    return
  }

  const pending = match.registrations.filter(
    (registration) => registration.status === 'PENDING'
  )

  for (const registration of pending.slice(0, freeSlots)) {
    const teamId = await ensureTeamForRegistration(registration)
    await prisma.matchRegistration.update({
      where: { id: registration.id },
      data: { status: 'APPROVED', teamId },
    })
  }

  await syncMatchStatusByCapacity(matchId)
}

export const hasActiveRegistrationForCaptain = async ({
  matchId,
  captainLogins,
}) => {
  const logins = [...new Set(captainLogins.filter(Boolean))]
  if (logins.length === 0) return false

  const existing = await prisma.matchRegistration.findFirst({
    where: {
      matchId,
      captainLogin: { in: logins },
      status: { in: ACTIVE_REGISTRATION_STATUSES },
    },
  })

  return Boolean(existing)
}

export const hasActiveRegistrationForTeam = async ({ matchId, teamId }) => {
  if (!teamId) return false

  const existing = await prisma.matchRegistration.findFirst({
    where: {
      matchId,
      teamId,
      status: { in: ACTIVE_REGISTRATION_STATUSES },
    },
  })

  return Boolean(existing)
}

export const getAutoApprovalStatus = async (matchId) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      stadium: true,
      registrations: {
        where: { status: 'APPROVED' },
      },
    },
  })
  if (!match) return null

  if (match.approvalMode !== 'AUTO_FIRST_COME') {
    return { match, status: 'PENDING' }
  }

  return {
    match,
    status: match.registrations.length < match.maxTeams ? 'APPROVED' : 'PENDING',
  }
}

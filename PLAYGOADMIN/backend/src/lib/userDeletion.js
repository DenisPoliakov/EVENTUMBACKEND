import prisma from '../prisma.js'
import { promotePendingRegistrations, syncMatchStatusByCapacity } from './registrations.js'

const buildUserDisplayName = (user) =>
  `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
  user?.username ||
  user?.name ||
  user?.email ||
  'Unknown user'

const buildUserLogin = (user) => user?.username || user?.email || ''

const getReplacementCaptain = (members, removingUserId) =>
  (members || []).find((member) => member.userId !== removingUserId) || null

export const deleteUserAccount = async (userId) => {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        captainedTeams: {
          include: {
            members: {
              include: { user: true },
              orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    })

    if (!user) return null

    const affectedMatchIds = new Set()

    for (const team of user.captainedTeams) {
      const replacement = getReplacementCaptain(team.members, userId)

      if (replacement?.user) {
        await tx.team.update({
          where: { id: team.id },
          data: { captainUserId: replacement.userId },
        })

        await tx.teamMember.update({
          where: { id: replacement.id },
          data: { role: 'CAPTAIN' },
        })

        await tx.matchRegistration.updateMany({
          where: { teamId: team.id },
          data: {
            captainName: buildUserDisplayName(replacement.user),
            captainLogin: buildUserLogin(replacement.user),
          },
        })
      } else {
        const registrations = await tx.matchRegistration.findMany({
          where: { teamId: team.id },
          select: { matchId: true },
        })

        for (const registration of registrations) {
          affectedMatchIds.add(registration.matchId)
        }

        await tx.matchRegistration.deleteMany({ where: { teamId: team.id } })
        await tx.teamInvitation.deleteMany({ where: { teamId: team.id } })
        await tx.teamMember.deleteMany({ where: { teamId: team.id } })
        await tx.team.delete({ where: { id: team.id } })
      }
    }

    await tx.teamInvitation.deleteMany({
      where: {
        OR: [{ inviterUserId: userId }, { inviteeUserId: userId }],
      },
    })

    await tx.teamMember.deleteMany({ where: { userId } })
    await tx.coachProfile.deleteMany({ where: { userId } })
    await tx.playerCard.deleteMany({ where: { userId } })
    await tx.payment.deleteMany({ where: { order: { userId } } })
    await tx.order.deleteMany({ where: { userId } })
    await tx.userSubscription.deleteMany({ where: { userId } })
    await tx.appPremiumSubscription.deleteMany({ where: { userId } })
    await tx.user.delete({ where: { id: userId } })

    return {
      deletedUserId: user.id,
      affectedMatchIds: [...affectedMatchIds],
    }
  })

  if (!result) return null

  for (const matchId of result.affectedMatchIds) {
    await syncMatchStatusByCapacity(matchId)
    await promotePendingRegistrations(matchId)
  }

  return result
}

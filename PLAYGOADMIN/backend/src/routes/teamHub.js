import express from 'express'
import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

const includeTeamShape = {
  city: true,
  captain: true,
  members: {
    include: {
      user: true,
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  },
  invitations: {
    where: { status: 'PENDING' },
    include: {
      invitee: true,
      inviter: true,
    },
    orderBy: { createdAt: 'desc' },
  },
}

const serializeTeam = (team) => ({
  id: team.id,
  name: team.name,
  cityId: team.cityId,
  city: team.city?.name || '',
  captainUserId: team.captainUserId,
  captain: {
    id: team.captain?.id || '',
    username: team.captain?.username || '',
    firstName: team.captain?.firstName || '',
    lastName: team.captain?.lastName || '',
    email: team.captain?.email || '',
  },
  members: (team.members || []).map((member) => ({
    id: member.id,
    userId: member.userId,
    role: member.role,
    fieldPosition: member.fieldPosition || '',
    user: {
      id: member.user?.id || '',
      username: member.user?.username || '',
      firstName: member.user?.firstName || '',
      lastName: member.user?.lastName || '',
      email: member.user?.email || '',
    },
  })),
  invitations: (team.invitations || []).map((invite) => ({
    id: invite.id,
    status: invite.status,
    inviteeIdentifier: invite.inviteeIdentifier,
    createdAt: invite.createdAt,
    invitee: {
      id: invite.invitee?.id || '',
      username: invite.invitee?.username || '',
      firstName: invite.invitee?.firstName || '',
      lastName: invite.invitee?.lastName || '',
      email: invite.invitee?.email || '',
    },
  })),
})

const serializeInvitation = (invite) => ({
  id: invite.id,
  status: invite.status,
  inviteeIdentifier: invite.inviteeIdentifier,
  createdAt: invite.createdAt,
  respondedAt: invite.respondedAt,
  team: invite.team
    ? {
        id: invite.team.id,
        name: invite.team.name,
        city: invite.team.city?.name || '',
        captain: {
          id: invite.team.captain?.id || '',
          username: invite.team.captain?.username || '',
          firstName: invite.team.captain?.firstName || '',
          lastName: invite.team.captain?.lastName || '',
          email: invite.team.captain?.email || '',
        },
      }
    : null,
  inviter: invite.inviter
    ? {
        id: invite.inviter.id,
        username: invite.inviter.username || '',
        firstName: invite.inviter.firstName || '',
        lastName: invite.inviter.lastName || '',
        email: invite.inviter.email || '',
      }
    : null,
})

const getCurrentTeamForUser = async (userId) => {
  const captained = await prisma.team.findFirst({
    where: { captainUserId: userId },
    include: includeTeamShape,
  })
  if (captained) return captained

  const membership = await prisma.teamMember.findFirst({
    where: { userId },
    include: {
      team: {
        include: includeTeamShape,
      },
    },
  })
  return membership?.team || null
}

const ensureNoExistingTeam = async (userId) => {
  const current = await getCurrentTeamForUser(userId)
  if (current) {
    const error = new Error('User already has a team')
    error.statusCode = 409
    throw error
  }
}

const ensureCaptainOwnsTeam = async (teamId, captainUserId) => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: includeTeamShape,
  })
  if (!team) {
    const error = new Error('Team not found')
    error.statusCode = 404
    throw error
  }
  if (team.captainUserId !== captainUserId) {
    const error = new Error('Only captain can manage the team')
    error.statusCode = 403
    throw error
  }
  return team
}

router.get('/me/team', requireAuth, async (req, res, next) => {
  try {
    const team = await getCurrentTeamForUser(req.auth.sub)
    res.json({ team: team ? serializeTeam(team) : null })
  } catch (err) {
    next(err)
  }
})

router.post('/me/team', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim()
    if (!name) {
      return res.status(400).json({ error: 'Team name is required' })
    }

    await ensureNoExistingTeam(req.auth.sub)

    const user = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      include: { playerCard: true },
    })
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (!user.cityId) {
      return res.status(400).json({ error: 'Set city in profile before creating a team' })
    }

    const team = await prisma.team.create({
      data: {
        name,
        cityId: user.cityId,
        captainUserId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'CAPTAIN',
            fieldPosition: ['GK', 'DF', 'MF', 'FW'].includes(
              user.playerCard?.position || ''
            )
              ? user.playerCard.position
              : null,
          },
        },
      },
      include: includeTeamShape,
    })

    res.status(201).json({ team: serializeTeam(team) })
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Team name already exists in this city' })
    }
    next(err)
  }
})

router.post('/me/team/invitations', requireAuth, async (req, res, next) => {
  try {
    const identifier = String(req.body.identifier || '').trim().toLowerCase()
    if (!identifier) {
      return res.status(400).json({ error: 'Identifier is required' })
    }

    const team = await ensureCaptainOwnsTeam(String(req.body.teamId || ''), req.auth.sub)

    const invitee = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    })
    if (!invitee) return res.status(404).json({ error: 'User not found' })
    if (invitee.id === req.auth.sub) {
      return res.status(400).json({ error: 'Captain cannot invite himself' })
    }

    await ensureNoExistingTeam(invitee.id)

    const pendingInvite = await prisma.teamInvitation.findFirst({
      where: {
        teamId: team.id,
        inviteeUserId: invitee.id,
        status: 'PENDING',
      },
    })
    if (pendingInvite) {
      return res.status(409).json({ error: 'Invitation is already pending' })
    }

    const invite = await prisma.teamInvitation.create({
      data: {
        teamId: team.id,
        inviterUserId: req.auth.sub,
        inviteeUserId: invitee.id,
        inviteeIdentifier: identifier,
      },
      include: {
        team: { include: { city: true, captain: true } },
        inviter: true,
      },
    })

    res.status(201).json({ invitation: serializeInvitation(invite) })
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    next(err)
  }
})

router.get('/me/team-invitations', requireAuth, async (req, res, next) => {
  try {
    const invites = await prisma.teamInvitation.findMany({
      where: {
        inviteeUserId: req.auth.sub,
        status: 'PENDING',
      },
      include: {
        team: { include: { city: true, captain: true } },
        inviter: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ invitations: invites.map(serializeInvitation) })
  } catch (err) {
    next(err)
  }
})

router.post('/me/team-invitations/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const invite = await prisma.teamInvitation.findUnique({
      where: { id: req.params.id },
      include: { team: true },
    })
    if (!invite || invite.inviteeUserId !== req.auth.sub) {
      return res.status(404).json({ error: 'Invitation not found' })
    }
    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invitation is not active' })
    }

    await ensureNoExistingTeam(req.auth.sub)
    const invitee = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      include: { playerCard: true },
    })

    await prisma.teamMember.create({
      data: {
        teamId: invite.teamId,
        userId: req.auth.sub,
        role: 'MEMBER',
        fieldPosition: ['GK', 'DF', 'MF', 'FW'].includes(
          invitee?.playerCard?.position || ''
        )
          ? invitee.playerCard.position
          : null,
      },
    })

    await prisma.teamInvitation.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    })

    const team = await prisma.team.findUnique({
      where: { id: invite.teamId },
      include: includeTeamShape,
    })

    res.json({ team: team ? serializeTeam(team) : null })
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'You are already in this team' })
    }
    next(err)
  }
})

router.post('/me/team-invitations/:id/reject', requireAuth, async (req, res, next) => {
  try {
    const invite = await prisma.teamInvitation.findUnique({
      where: { id: req.params.id },
    })
    if (!invite || invite.inviteeUserId !== req.auth.sub) {
      return res.status(404).json({ error: 'Invitation not found' })
    }
    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invitation is not active' })
    }

    await prisma.teamInvitation.update({
      where: { id: invite.id },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
      },
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.patch('/me/team/members/:memberId', requireAuth, async (req, res, next) => {
  try {
    const role = String(req.body.role || '').trim().toUpperCase()
    const fieldPosition = String(req.body.fieldPosition || '')
      .trim()
      .toUpperCase()
    if (!['MEMBER', 'SUBSTITUTE'].includes(role)) {
      return res.status(400).json({ error: 'Role must be MEMBER or SUBSTITUTE' })
    }
    if (fieldPosition && !['GK', 'DF', 'MF', 'FW'].includes(fieldPosition)) {
      return res.status(400).json({ error: 'Field position must be GK, DF, MF or FW' })
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: req.params.memberId },
      include: { team: true },
    })
    if (!member) return res.status(404).json({ error: 'Team member not found' })
    if (member.role === 'CAPTAIN') {
      return res.status(400).json({ error: 'Captain role cannot be changed here' })
    }

    await ensureCaptainOwnsTeam(member.teamId, req.auth.sub)

    const updated = await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        role,
        fieldPosition: fieldPosition || null,
      },
      include: {
        user: true,
      },
    })

    res.json({
      member: {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
        fieldPosition: updated.fieldPosition || '',
        user: {
          id: updated.user?.id || '',
          username: updated.user?.username || '',
          firstName: updated.user?.firstName || '',
          lastName: updated.user?.lastName || '',
          email: updated.user?.email || '',
        },
      },
    })
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    next(err)
  }
})

router.get('/teams/:id/public', async (req, res, next) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: includeTeamShape,
    })
    if (!team) return res.status(404).json({ error: 'Team not found' })
    res.json({ team: serializeTeam(team) })
  } catch (err) {
    next(err)
  }
})

export default router

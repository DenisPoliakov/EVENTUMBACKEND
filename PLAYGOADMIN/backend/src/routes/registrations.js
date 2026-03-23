import express from 'express'
import prisma from '../prisma.js'
import fetch from 'node-fetch'
import {
  ensureTeamForRegistration,
  promotePendingRegistrations,
  syncMatchStatusByCapacity,
} from '../lib/registrations.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const { matchId, status, captainLogin } = req.query
    const registrations = await prisma.matchRegistration.findMany({
      where: {
        matchId: matchId || undefined,
        status: status || undefined,
        captainLogin: captainLogin || undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        team: { include: { captain: true } },
        match: { include: { stadium: { include: { city: true } } } },
      },
    })
    res.json(registrations)
  } catch (err) {
    next(err)
  }
})

// Создание заявки без существующей команды: teamName, captainName, captainLogin
router.post('/', async (req, res, next) => {
  try {
    const { matchId, teamName, captainName, captainLogin, note, playersCount } = req.body
    if (!matchId || !teamName || !captainName || !captainLogin) {
      return res.status(400).json({ error: 'matchId, teamName, captainName, captainLogin are required' })
    }
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { stadium: true },
    })
    if (!match) return res.status(404).json({ error: 'Match not found' })

    const registration = await prisma.matchRegistration.create({
      data: {
        matchId,
        teamName,
        captainName,
        captainLogin,
        cityId: match.stadium.cityId,
        stadiumId: match.stadiumId,
        note,
        playersCount: playersCount !== undefined ? Number(playersCount) : null,
      },
    })
    res.status(201).json(registration)
  } catch (err) {
    next(err)
  }
})

// approve / reject
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const registration = await prisma.matchRegistration.findUnique({
      where: { id: req.params.id },
      include: { match: { include: { stadium: true } } },
    })
    if (!registration) return res.status(404).json({ error: 'Registration not found' })

    let teamId = registration.teamId
    if (status === 'APPROVED' && !teamId) {
      teamId = await ensureTeamForRegistration(registration)
    }

    const updated = await prisma.matchRegistration.update({
      where: { id: req.params.id },
      data: { status, teamId },
    })
    await syncMatchStatusByCapacity(updated.matchId)
    if (status === 'REJECTED') {
      await promotePendingRegistrations(updated.matchId)
    }

    // Webhook уведомление (если настроено)
    if (process.env.WEBHOOK_URL) {
      try {
        await fetch(process.env.WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'registration_status',
            id: updated.id,
            status: updated.status,
            matchId: updated.matchId,
            teamName: updated.teamName,
            captainName: updated.captainName,
            captainLogin: updated.captainLogin,
            cityId: updated.cityId,
            stadiumId: updated.stadiumId,
            at: new Date().toISOString(),
          }),
        })
      } catch (err) {
        console.error('Webhook send failed', err)
      }
    }

    res.json(updated)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Registration not found' })
    next(err)
  }
})

// Удаление заявки
router.delete('/:id', async (req, res, next) => {
  try {
    const registration = await prisma.matchRegistration.findUnique({
      where: { id: req.params.id },
    })
    if (!registration) return res.status(404).json({ error: 'Registration not found' })
    await prisma.matchRegistration.delete({ where: { id: req.params.id } })
    await syncMatchStatusByCapacity(registration.matchId)
    if (registration.status === 'APPROVED') {
      await promotePendingRegistrations(registration.matchId)
    }
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Registration not found' })
    next(err)
  }
})

export default router

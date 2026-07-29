import express from 'express'

import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

const cleanText = (value, field, maxLength) => {
  const text = String(value ?? '').trim()
  if (!text) return { error: `${field} is required` }
  if (text.length > maxLength) {
    return { error: `${field} must be at most ${maxLength} characters` }
  }
  return { value: text }
}

const publicTicketInclude = {
  messages: {
    where: { isInternal: false },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
}

router.get('/me/support', requireAuth, async (req, res, next) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.auth.sub },
      include: publicTicketInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })
    res.json({ tickets })
  } catch (error) {
    next(error)
  }
})

router.post('/me/support', requireAuth, async (req, res, next) => {
  try {
    const subject = cleanText(req.body?.subject, 'subject', 200)
    if (subject.error) return res.status(400).json({ error: subject.error })
    const message = cleanText(req.body?.message, 'message', 10_000)
    if (message.error) return res.status(400).json({ error: message.error })
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.auth.sub,
        subject: subject.value,
        messages: {
          create: {
            authorType: 'USER',
            authorUserId: req.auth.sub,
            body: message.value,
          },
        },
      },
      include: publicTicketInclude,
    })
    res.status(201).json(ticket)
  } catch (error) {
    next(error)
  }
})

router.post('/me/support/:id/replies', requireAuth, async (req, res, next) => {
  try {
    const body = cleanText(req.body?.message, 'message', 10_000)
    if (body.error) return res.status(400).json({ error: body.error })
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, userId: req.auth.sub },
    })
    if (!ticket) return res.status(404).json({ error: 'Support ticket not found' })
    if (ticket.status === 'CLOSED') {
      return res.status(409).json({ error: 'Closed support tickets cannot be replied to' })
    }
    await prisma.$transaction([
      prisma.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorType: 'USER',
          authorUserId: req.auth.sub,
          body: body.value,
        },
      }),
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: 'OPEN' },
      }),
    ])
    const updated = await prisma.supportTicket.findUnique({
      where: { id: ticket.id },
      include: publicTicketInclude,
    })
    res.status(201).json(updated)
  } catch (error) {
    next(error)
  }
})

export default router

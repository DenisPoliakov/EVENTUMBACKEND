import express from 'express'

import prisma from '../prisma.js'

const router = express.Router()
const statuses = new Set(['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'])
const priorities = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT'])

const cleanBody = (value) => {
  const body = String(value ?? '').trim()
  if (!body) return { error: 'body is required' }
  if (body.length > 10_000) return { error: 'body must be at most 10000 characters' }
  return { value: body }
}

const includeDetail = {
  user: { select: { id: true, email: true, username: true, name: true } },
  messages: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      authorUser: { select: { id: true, email: true, username: true, name: true } },
    },
  },
}

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined
    if (status && !statuses.has(status)) return res.status(400).json({ error: 'status is invalid' })
    const priority = req.query.priority ? String(req.query.priority).toUpperCase() : undefined
    if (priority && !priorities.has(priority)) return res.status(400).json({ error: 'priority is invalid' })
    const tickets = await prisma.supportTicket.findMany({
      where: { status, priority },
      include: {
        user: { select: { id: true, email: true, username: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 250,
    })
    res.json({ tickets })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: includeDetail,
    })
    if (!ticket) return res.status(404).json({ error: 'Support ticket not found' })
    res.json(ticket)
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const data = {}
    if (Object.hasOwn(req.body ?? {}, 'status')) {
      const status = String(req.body.status).toUpperCase()
      if (!statuses.has(status)) return res.status(400).json({ error: 'status is invalid' })
      data.status = status
      data.resolvedAt = ['RESOLVED', 'CLOSED'].includes(status) ? new Date() : null
    }
    if (Object.hasOwn(req.body ?? {}, 'priority')) {
      const priority = String(req.body.priority).toUpperCase()
      if (!priorities.has(priority)) return res.status(400).json({ error: 'priority is invalid' })
      data.priority = priority
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'status or priority is required' })
    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data,
      include: includeDetail,
    })
    res.json(ticket)
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Support ticket not found' })
    next(error)
  }
})

const addAdminMessage = (isInternal) => async (req, res, next) => {
  try {
    const body = cleanBody(req.body?.body)
    if (body.error) return res.status(400).json({ error: body.error })
    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } })
    if (!ticket) return res.status(404).json({ error: 'Support ticket not found' })
    const [message] = await prisma.$transaction([
      prisma.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorType: 'ADMIN',
          body: body.value,
          isInternal,
        },
      }),
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: isInternal ? {} : { status: 'WAITING_USER' },
      }),
    ])
    res.status(201).json(message)
  } catch (error) {
    next(error)
  }
}

router.post('/:id/replies', addAdminMessage(false))
router.post('/:id/notes', addAdminMessage(true))

export default router

import express from 'express'

import prisma from '../prisma.js'
import { previewCampaign, sendCampaign } from '../lib/pushCampaigns.js'

const router = express.Router()
const segments = new Set(['ALL_USERS', 'SELECTED_USERS', 'FAVORITE_CLUB'])

const text = (value, field, max) => {
  const cleaned = String(value ?? '').trim()
  if (!cleaned) return { error: `${field} is required` }
  if (cleaned.length > max) return { error: `${field} must be at most ${max} characters` }
  return { value: cleaned }
}

const optionalData = (value) => {
  if (value === undefined || value === null) return { value: null }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'data must be a JSON object' }
  }
  if (Buffer.byteLength(JSON.stringify(value)) > 20_000) {
    return { error: 'data must not exceed 20000 bytes' }
  }
  return { value }
}

const validateContent = (body, { template = false } = {}) => {
  const name = text(body?.name, 'name', 200)
  if (name.error) return name
  const title = text(body?.title, 'title', 200)
  if (title.error) return title
  const message = text(body?.body, 'body', 1000)
  if (message.error) return message
  const data = optionalData(body?.data)
  if (data.error) return data
  const imageUrl = String(body?.imageUrl ?? '').trim()
  if (imageUrl.length > 2000) return { error: 'imageUrl must be at most 2000 characters' }
  const result = {
    name: name.value,
    title: title.value,
    body: message.value,
    imageUrl: imageUrl || null,
    data: data.value,
  }
  if (template) return { data: result }

  const targetSegment = String(body?.targetSegment ?? '').toUpperCase()
  if (!segments.has(targetSegment)) return { error: 'targetSegment is invalid' }
  const selectedUserIds = Array.isArray(body?.selectedUserIds)
    ? [...new Set(body.selectedUserIds.map(String).map((item) => item.trim()).filter(Boolean))]
    : []
  if (selectedUserIds.length > 2000) return { error: 'selectedUserIds must not exceed 2000 users' }
  const favoriteClubId = String(body?.favoriteClubId ?? '').trim() || null
  if (targetSegment === 'SELECTED_USERS' && !selectedUserIds.length) {
    return { error: 'selectedUserIds is required for SELECTED_USERS' }
  }
  if (targetSegment === 'FAVORITE_CLUB' && !favoriteClubId) {
    return { error: 'favoriteClubId is required for FAVORITE_CLUB' }
  }
  return {
    data: {
      ...result,
      targetSegment,
      selectedUserIds,
      favoriteClubId: targetSegment === 'FAVORITE_CLUB' ? favoriteClubId : null,
    },
  }
}

router.get('/', async (_req, res, next) => {
  try {
    const campaigns = await prisma.pushCampaign.findMany({
      include: { favoriteClub: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 250,
    })
    res.json({ campaigns })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const validated = validateContent(req.body)
    if (validated.error) return res.status(400).json({ error: validated.error })
    if (validated.data.favoriteClubId) {
      const club = await prisma.sportClub.findUnique({
        where: { id: validated.data.favoriteClubId },
        select: { id: true },
      })
      if (!club) return res.status(404).json({ error: 'Favorite club target not found' })
    }
    const campaign = await prisma.pushCampaign.create({ data: validated.data })
    res.status(201).json(campaign)
  } catch (error) {
    next(error)
  }
})

router.get('/:id/preview', async (req, res, next) => {
  try {
    const campaign = await prisma.pushCampaign.findUnique({ where: { id: req.params.id } })
    if (!campaign) return res.status(404).json({ error: 'Push campaign not found' })
    res.json(await previewCampaign(campaign))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/send', async (req, res, next) => {
  try {
    const campaign = await prisma.pushCampaign.findUnique({ where: { id: req.params.id } })
    if (!campaign) return res.status(404).json({ error: 'Push campaign not found' })
    if (campaign.status === 'SENT') {
      return res.json({ campaign, deduped: true })
    }
    const result = await sendCampaign(campaign.id)
    res.status(result.deduped ? 200 : 202).json(result)
  } catch (error) {
    next(error)
  }
})

router.get('/templates', async (_req, res, next) => {
  try {
    res.json({
      templates: await prisma.pushTemplate.findMany({ orderBy: { name: 'asc' }, take: 250 }),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/templates', async (req, res, next) => {
  try {
    const validated = validateContent(req.body, { template: true })
    if (validated.error) return res.status(400).json({ error: validated.error })
    const template = await prisma.pushTemplate.create({ data: validated.data })
    res.status(201).json(template)
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Template name already exists' })
    next(error)
  }
})

router.put('/templates/:id', async (req, res, next) => {
  try {
    const validated = validateContent(req.body, { template: true })
    if (validated.error) return res.status(400).json({ error: validated.error })
    res.json(await prisma.pushTemplate.update({ where: { id: req.params.id }, data: validated.data }))
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Push template not found' })
    next(error)
  }
})

router.delete('/templates/:id', async (req, res, next) => {
  try {
    await prisma.pushTemplate.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Push template not found' })
    next(error)
  }
})

export default router

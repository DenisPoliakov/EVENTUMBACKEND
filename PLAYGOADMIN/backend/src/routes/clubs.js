import express from 'express'
import prisma from '../prisma.js'
import {
  clubInclude,
  normalizeCoaches,
  normalizeStringList,
  normalizeSchedules,
  serializeClub,
  toNullableInt,
  toNullableNumber,
} from '../lib/ecosystem.js'

const router = express.Router()

const buildWhere = (query) => {
  const sportId = String(query.sportId || '').trim()
  const sportCode = String(query.sportCode || '').trim().toUpperCase()
  const cityId = String(query.cityId || '').trim()
  const city = String(query.city || '').trim()
  const age = toNullableInt(query.age)

  return {
    sportId: sportId || undefined,
    sport: sportCode ? { code: sportCode } : undefined,
    cityId: cityId || undefined,
    city: city ? { name: { equals: city, mode: 'insensitive' } } : undefined,
    AND:
      age == null
        ? undefined
        : [
            { OR: [{ minAge: null }, { minAge: { lte: age } }] },
            { OR: [{ maxAge: null }, { maxAge: { gte: age } }] },
          ],
  }
}

const buildData = (body) => ({
  sportId: body.sportId,
  cityId: body.cityId || null,
  name: String(body.name || '').trim(),
  kind: String(body.kind || '').trim() || null,
  address: String(body.address || '').trim(),
  description: String(body.description || '').trim() || null,
  latitude: toNullableNumber(body.latitude),
  longitude: toNullableNumber(body.longitude),
  imageUrl: String(body.imageUrl || '').trim() || null,
  galleryUrls: normalizeStringList(body.galleryUrls),
  yandexMapsUrl: String(body.yandexMapsUrl || '').trim() || null,
  contactPhone: String(body.contactPhone || '').trim() || null,
  contactEmail: String(body.contactEmail || '').trim() || null,
  websiteUrl: String(body.websiteUrl || '').trim() || null,
  telegramUrl: String(body.telegramUrl || '').trim() || null,
  vkUrl: String(body.vkUrl || '').trim() || null,
  instagramUrl: String(body.instagramUrl || '').trim() || null,
  minAge: toNullableInt(body.minAge),
  maxAge: toNullableInt(body.maxAge),
  coaches: normalizeCoaches(body.coaches),
})

router.get('/', async (req, res, next) => {
  try {
    const clubs = await prisma.sportClub.findMany({
      where: buildWhere(req.query),
      orderBy: { name: 'asc' },
      include: clubInclude,
    })
    res.json(clubs.map(serializeClub))
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const data = buildData(req.body)
    if (!data.sportId || !data.name || !data.address) {
      return res.status(400).json({ error: 'sportId, name and address are required' })
    }

    const schedules = normalizeSchedules(req.body.schedules)
    const club = await prisma.sportClub.create({
      data: {
        ...data,
        schedules: schedules.length ? { create: schedules } : undefined,
      },
      include: clubInclude,
    })
    res.status(201).json(serializeClub(club))
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Club already exists for this sport and city' })
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const club = await prisma.sportClub.findUnique({
      where: { id: req.params.id },
      include: clubInclude,
    })
    if (!club) return res.status(404).json({ error: 'Club not found' })
    res.json(serializeClub(club))
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const data = buildData(req.body)
    const schedules = normalizeSchedules(req.body.schedules)
    const club = await prisma.$transaction(async (tx) => {
      await tx.clubSchedule.deleteMany({ where: { clubId: req.params.id } })
      return tx.sportClub.update({
        where: { id: req.params.id },
        data: {
          ...data,
          schedules: schedules.length ? { create: schedules } : undefined,
        },
        include: clubInclude,
      })
    })
    res.json(serializeClub(club))
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Club not found' })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Club already exists for this sport and city' })
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.sportClub.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Club not found' })
    next(err)
  }
})

export default router

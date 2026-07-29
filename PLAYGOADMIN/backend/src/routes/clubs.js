import express from 'express'
import prisma from '../prisma.js'
import {
  clubInclude,
  normalizeCoaches,
  normalizeClubTier,
  normalizeMediaUrl,
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
  tier: normalizeClubTier(body.tier),
  imageUrl: normalizeMediaUrl(body.imageUrl || body.logoUrl) || null,
  logoUrl: normalizeMediaUrl(body.logoUrl || body.imageUrl) || null,
  galleryUrls: normalizeStringList(body.galleryUrls || body.imageUrls).map(
    normalizeMediaUrl,
  ),
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

const validateSchedules = (schedules) => {
  for (const schedule of schedules) {
    if (
      schedule.priceCents == null ||
      schedule.priceCents < 0 ||
      (schedule.dayOfWeek != null &&
        (schedule.dayOfWeek < 1 || schedule.dayOfWeek > 7))
    ) {
      return 'Each schedule requires a non-negative priceCents and dayOfWeek from 1 to 7'
    }
  }
  return null
}

const validateScheduleCoaches = async (tx, clubId, schedules) => {
  const coachIds = [
    ...new Set(schedules.map((schedule) => schedule.coachProfileId).filter(Boolean)),
  ]
  if (!coachIds.length) return

  const count = await tx.coachProfile.count({
    where: { id: { in: coachIds }, clubId },
  })
  if (count !== coachIds.length) {
    const error = new Error('Every schedule coachProfileId must belong to the club')
    error.status = 400
    throw error
  }
}

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
    if (!data.tier) return res.status(400).json({ error: 'tier is invalid' })

    const schedules = normalizeSchedules(req.body.schedules)
    const scheduleError = validateSchedules(schedules)
    if (scheduleError) return res.status(400).json({ error: scheduleError })

    const club = await prisma.$transaction(async (tx) => {
      const created = await tx.sportClub.create({ data })
      await validateScheduleCoaches(tx, created.id, schedules)
      if (schedules.length) {
        await tx.clubSchedule.createMany({
          data: schedules.map(({ id: _id, ...schedule }) => ({
            ...schedule,
            clubId: created.id,
          })),
        })
      }
      return tx.sportClub.findUnique({
        where: { id: created.id },
        include: clubInclude,
      })
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
    if (!data.tier) return res.status(400).json({ error: 'tier is invalid' })
    const schedules = normalizeSchedules(req.body.schedules)
    const scheduleError = validateSchedules(schedules)
    if (scheduleError) return res.status(400).json({ error: scheduleError })

    const club = await prisma.$transaction(async (tx) => {
      const existing = await tx.sportClub.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      })
      if (!existing) {
        const error = new Error('Club not found')
        error.status = 404
        throw error
      }

      await validateScheduleCoaches(tx, existing.id, schedules)
      const incomingIds = schedules.map((schedule) => schedule.id).filter(Boolean)
      if (incomingIds.length) {
        const ownedCount = await tx.clubSchedule.count({
          where: { clubId: existing.id, id: { in: incomingIds } },
        })
        if (ownedCount !== incomingIds.length) {
          const error = new Error('Schedule entry does not belong to this club')
          error.status = 400
          throw error
        }
      }

      await tx.sportClub.update({
        where: { id: req.params.id },
        data,
      })
      await tx.clubSchedule.deleteMany({
        where: {
          clubId: existing.id,
          id: incomingIds.length ? { notIn: incomingIds } : undefined,
        },
      })
      for (const schedule of schedules) {
        const { id, ...scheduleData } = schedule
        if (id) {
          await tx.clubSchedule.update({ where: { id }, data: scheduleData })
        } else {
          await tx.clubSchedule.create({
            data: { ...scheduleData, clubId: existing.id },
          })
        }
      }
      return tx.sportClub.findUnique({
        where: { id: existing.id },
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

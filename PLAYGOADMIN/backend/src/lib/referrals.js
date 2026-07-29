import crypto from 'crypto'

import prisma from '../prisma.js'

const normalizeCode = (value) => String(value || '').trim().toUpperCase()

export const ensureReferralCode = async (userId, client = prisma) => {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })
  if (!user) return null
  if (user.referralCode) return user.referralCode

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase()
    try {
      const updated = await client.user.updateMany({
        where: { id: userId, referralCode: null },
        data: { referralCode: code },
      })
      if (updated.count === 1) return code
      const current = await client.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      })
      if (current?.referralCode) return current.referralCode
    } catch (error) {
      if (error.code !== 'P2002') throw error
      const current = await client.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      })
      if (current?.referralCode) return current.referralCode
    }
  }
  throw new Error('Could not allocate a unique referral code')
}

export const applyReferralCode = async (referredUserId, rawCode) => {
  const code = normalizeCode(rawCode)
  if (!code) return { status: 400, error: 'referralCode is required' }
  const ownCode = await ensureReferralCode(referredUserId)
  if (!ownCode) return { status: 401, error: 'Unauthorized' }
  if (ownCode === code) return { status: 400, error: 'You cannot apply your own referral code' }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${referredUserId} FOR UPDATE`

    const existing = await tx.referralRedemption.findUnique({
      where: { referredUserId },
    })
    if (existing) return { status: 409, error: 'A referral code was already applied' }

    const referrer = await tx.user.findFirst({
      where: { referralCode: { equals: code, mode: 'insensitive' } },
      select: { id: true, referralCode: true },
    })
    if (!referrer) return { status: 404, error: 'Referral code not found' }
    if (referrer.id === referredUserId) {
      return { status: 400, error: 'You cannot apply your own referral code' }
    }

    const redemption = await tx.referralRedemption.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId,
        code: referrer.referralCode,
      },
    })
    return { status: 201, redemption }
  })
}

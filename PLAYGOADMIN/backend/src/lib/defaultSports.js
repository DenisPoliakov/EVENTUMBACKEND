import prisma from '../prisma.js'

const DEFAULT_SPORTS = [
  { code: 'FOOTBALL', name: 'Футбол', description: 'Футбольные стадионы, матчи и команды' },
  { code: 'BOXING', name: 'Бокс', description: 'Боксерские клубы, залы и тренировки' },
]

export const ensureDefaultSports = async () => {
  for (const sport of DEFAULT_SPORTS) {
    await prisma.sport.upsert({
      where: { code: sport.code },
      update: {
        name: sport.name,
        description: sport.description,
      },
      create: sport,
    })
  }
}

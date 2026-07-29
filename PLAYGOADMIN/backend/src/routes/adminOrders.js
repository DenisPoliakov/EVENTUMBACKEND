import express from 'express'

import prisma from '../prisma.js'
import { orderInclude, serializeOrder } from '../lib/orders.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: req.query.status || undefined,
        clubId: req.query.clubId || undefined,
        userId: req.query.userId || undefined,
        payment: req.query.paymentStatus
          ? { is: { status: req.query.paymentStatus } }
          : undefined,
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    res.json(orders.map(serializeOrder))
  } catch (error) {
    next(error)
  }
})

export default router

import express from 'express'

import prisma from '../prisma.js'
import { activatePaidOrder, orderInclude, serializeOrder } from '../lib/orders.js'
import {
  getYooKassaPayment,
  PaymentsNotConfiguredError,
  verifyYooKassaPayment,
} from '../lib/yookassa.js'

const router = express.Router()

router.post('/webhooks/yookassa', async (req, res, next) => {
  try {
    const externalId = String(req.body?.object?.id || '').trim()
    if (!externalId) return res.status(400).json({ error: 'Payment external ID is required' })

    let providerPayment
    try {
      providerPayment = await getYooKassaPayment(externalId)
    } catch (error) {
      if (error instanceof PaymentsNotConfiguredError) {
        return res.status(503).json({ error: error.message, code: error.code })
      }
      throw error
    }
    if (providerPayment.id !== externalId) {
      return res.status(400).json({ error: 'Provider payment ID mismatch' })
    }

    const orderId = String(providerPayment.metadata?.orderId || '').trim()
    const order = await prisma.order.findUnique({
      where: { id: orderId || '__missing__' },
      include: orderInclude,
    })
    if (
      !order ||
      !order.payment ||
      (order.payment.externalId && order.payment.externalId !== externalId)
    ) {
      return res.status(404).json({ error: 'Matching order was not found' })
    }
    if (['CANCELLED', 'FAILED'].includes(order.status)) {
      return res.status(409).json({ error: `Order is in terminal ${order.status} state` })
    }
    if (!verifyYooKassaPayment(providerPayment, order)) {
      return res.status(400).json({ error: 'Verified payment does not match the order' })
    }

    const activated = await activatePaidOrder(order.id, providerPayment)
    res.json({ ok: true, order: serializeOrder(activated) })
  } catch (error) {
    next(error)
  }
})

export default router

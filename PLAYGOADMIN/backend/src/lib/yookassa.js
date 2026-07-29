import { config } from '../config.js'

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super('YooKassa payments are not configured')
    this.code = 'PAYMENTS_NOT_CONFIGURED'
    this.status = 503
  }
}

const amountValue = (cents) => (cents / 100).toFixed(2)

const request = async (path, options = {}, fetchImpl = globalThis.fetch) => {
  if (!config.paymentsConfigured) throw new PaymentsNotConfiguredError()
  const response = await fetchImpl(`${config.yookassaApiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.yookassaShopId}:${config.yookassaSecretKey}`,
      ).toString('base64')}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.description || 'YooKassa request failed')
    error.status = 502
    error.code = 'PAYMENT_PROVIDER_ERROR'
    throw error
  }
  return body
}

export const createYooKassaPayment = async (order, fetchImpl) =>
  request(
    '/payments',
    {
      method: 'POST',
      headers: { 'Idempotence-Key': order.id },
      body: JSON.stringify({
        amount: {
          value: amountValue(order.amountCents),
          currency: order.currency,
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: config.yookassaReturnUrl,
        },
        description: `EVENTUM ${order.type.toLowerCase()} order ${order.id}`,
        metadata: {
          orderId: order.id,
          userId: order.userId,
          orderType: order.type,
          planId: order.planId || '',
          premiumPlanId: order.premiumPlanId || '',
        },
      }),
    },
    fetchImpl,
  )

export const getYooKassaPayment = async (externalId, fetchImpl) =>
  request(`/payments/${encodeURIComponent(externalId)}`, { method: 'GET' }, fetchImpl)

export const verifyYooKassaPayment = (providerPayment, order) => {
  const amountCents = Math.round(Number(providerPayment?.amount?.value) * 100)
  return (
    providerPayment?.id &&
    providerPayment.status === 'succeeded' &&
    providerPayment.paid === true &&
    amountCents === order.amountCents &&
    String(providerPayment.amount.currency || '').toUpperCase() === order.currency &&
    providerPayment.metadata?.orderId === order.id &&
    providerPayment.metadata?.userId === order.userId &&
    providerPayment.metadata?.orderType === order.type &&
    providerPayment.metadata?.planId === (order.planId || '') &&
    providerPayment.metadata?.premiumPlanId === (order.premiumPlanId || '')
  )
}

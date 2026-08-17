/** @typedef {'FOOTBALL' | 'CLUBS'} EventumProduct */

const PRODUCT_ALIASES = {
  FOOTBALL: 'FOOTBALL',
  FOOTBALL_APP: 'FOOTBALL',
  EVENTUM_FOOTBALL: 'FOOTBALL',
  SOCCER: 'FOOTBALL',
  CLUBS: 'CLUBS',
  CLUB: 'CLUBS',
  EVENTUM_CLUBS: 'CLUBS',
  BOXING: 'CLUBS',
  FITNESS: 'CLUBS',
}

/**
 * Resolve product scope from header / query / body.
 * Header: X-Eventum-Product: FOOTBALL | CLUBS
 */
export const resolveProductCode = (req, fallback = 'FOOTBALL') => {
  const raw =
    req?.headers?.['x-eventum-product'] ||
    req?.query?.product ||
    req?.query?.productCode ||
    req?.body?.product ||
    req?.body?.productCode ||
    fallback
  const normalized = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
  const product = PRODUCT_ALIASES[normalized]
  if (!product) {
    const error = new Error('product must be FOOTBALL or CLUBS')
    error.statusCode = 400
    throw error
  }
  return /** @type {EventumProduct} */ (product)
}

export const productFromSportCode = (sportCode) => {
  const code = String(sportCode || '')
    .trim()
    .toUpperCase()
  if (!code || code === 'FOOTBALL') return 'FOOTBALL'
  return 'CLUBS'
}

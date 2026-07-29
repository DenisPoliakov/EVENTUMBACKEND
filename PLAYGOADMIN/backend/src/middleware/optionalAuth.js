import { verifyToken } from '../lib/auth.js'

export const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization || ''
  if (!header) return next()
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    req.auth = verifyToken(header.slice(7))
    next()
  } catch (_err) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

import { verifyToken } from '../lib/auth.js'

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const payload = verifyToken(header.slice(7))
    req.auth = payload
    next()
  } catch (_err) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

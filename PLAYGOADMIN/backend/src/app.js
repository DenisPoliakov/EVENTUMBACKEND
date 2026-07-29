import crypto from 'crypto'
import path from 'path'

import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import morgan from 'morgan'

import { config } from './config.js'
import authRouter from './routes/auth.js'
import adminBookingsRouter from './routes/adminBookings.js'
import adminOrdersRouter from './routes/adminOrders.js'
import adminPremiumRouter from './routes/adminPremium.js'
import adminPushCampaignsRouter from './routes/adminPushCampaigns.js'
import adminSupportRouter from './routes/adminSupport.js'
import adminWorkoutAnalyticsRouter from './routes/adminWorkoutAnalytics.js'
import aiMatchHistoryRouter from './routes/aiMatchHistory.js'
import bookingsRouter from './routes/bookings.js'
import chatsRouter from './routes/chats.js'
import cityRouter from './routes/cities.js'
import clubRouter from './routes/clubs.js'
import crmRouter from './routes/crm.js'
import ecosystemRouter from './routes/ecosystem.js'
import friendsRouter from './routes/friends.js'
import matchRouter from './routes/matches.js'
import newsRouter from './routes/news.js'
import ordersRouter from './routes/orders.js'
import premiumRouter from './routes/premium.js'
import pushTokensRouter from './routes/pushTokens.js'
import publicRouter from './routes/public.js'
import registrationRouter from './routes/registrations.js'
import referralsRouter from './routes/referrals.js'
import sportRouter from './routes/sports.js'
import stadiumRouter from './routes/stadiums.js'
import subscriptionPlanRouter from './routes/subscriptionPlans.js'
import subscriptionRouter from './routes/subscriptions.js'
import supportRouter from './routes/support.js'
import teamHubRouter from './routes/teamHub.js'
import teamRouter from './routes/teams.js'
import uploadRouter from './routes/uploads.js'
import userRouter from './routes/users.js'
import wellnessStoriesRouter from './routes/wellnessStories.js'
import wellnessStoriesPublicRouter from './routes/wellnessStoriesPublic.js'
import workoutProgramsRouter from './routes/workoutPrograms.js'
import workoutProgramsPublicRouter from './routes/workoutProgramsPublic.js'
import workoutSessionsRouter from './routes/workoutSessions.js'
import yookassaWebhookRouter from './routes/yookassaWebhook.js'

const credentialsMatch = (provided, expected) => {
  const actualBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    const error = new Error('Origin is not allowed by CORS')
    error.status = 403
    callback(error)
  },
}

const createAuthLimiter = () =>
  rateLimit({
    windowMs: config.authRateLimitWindowMs,
    limit: config.authRateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts; try again later' },
  })

export const createApp = () => {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors(corsOptions))
  app.use(express.json({ limit: config.jsonBodyLimit }))
  app.use(morgan(config.isProduction ? 'combined' : 'dev'))
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')))

  app.use('/api/auth', createAuthLimiter())
  app.use('/api', publicRouter)
  app.use('/api', yookassaWebhookRouter)
  app.use('/api', authRouter)
  app.use('/api', teamHubRouter)
  app.use('/api', chatsRouter)
  app.use('/api', friendsRouter)
  app.use('/api', ecosystemRouter)
  app.use('/api', wellnessStoriesPublicRouter)
  app.use('/api', workoutProgramsPublicRouter)
  app.use('/api', workoutSessionsRouter)
  app.use('/api', bookingsRouter)
  app.use('/api', ordersRouter)
  app.use('/api', premiumRouter)
  app.use('/api', pushTokensRouter)
  app.use('/api', referralsRouter)
  app.use('/api', aiMatchHistoryRouter)
  app.use('/api', supportRouter)

  app.use('/api/admin', createAuthLimiter())
  app.use('/api/admin', (req, res, next) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Basic ')) {
      return res.status(401).set('WWW-Authenticate', 'Basic realm="admin"').json({ error: 'Auth required' })
    }

    let decoded
    try {
      decoded = Buffer.from(header.slice(6), 'base64').toString()
    } catch {
      decoded = ''
    }
    const separator = decoded.indexOf(':')
    const user = separator >= 0 ? decoded.slice(0, separator) : ''
    const password = separator >= 0 ? decoded.slice(separator + 1) : ''
    if (
      !credentialsMatch(user, config.adminUser) ||
      !credentialsMatch(password, config.adminPassword)
    ) {
      return res.status(401).set('WWW-Authenticate', 'Basic realm="admin"').json({ error: 'Invalid credentials' })
    }
    next()
  })

  app.use('/api/admin/cities', cityRouter)
  app.use('/api/admin/stadiums', stadiumRouter)
  app.use('/api/admin/matches', matchRouter)
  app.use('/api/admin/teams', teamRouter)
  app.use('/api/admin/users', userRouter)
  app.use('/api/admin/registrations', registrationRouter)
  app.use('/api/admin/news', newsRouter)
  app.use('/api/admin/sports', sportRouter)
  app.use('/api/admin/clubs', clubRouter)
  app.use('/api/admin/subscription-plans', subscriptionPlanRouter)
  app.use('/api/admin/subscriptions', subscriptionRouter)
  app.use('/api/admin/crm', crmRouter)
  app.use('/api/admin/uploads', uploadRouter)
  app.use('/api/admin/wellness-stories', wellnessStoriesRouter)
  app.use('/api/admin/workout-programs', workoutProgramsRouter)
  app.use('/api/admin/bookings', adminBookingsRouter)
  app.use('/api/admin/orders', adminOrdersRouter)
  app.use('/api/admin/premium', adminPremiumRouter)
  app.use('/api/admin/workout-analytics', adminWorkoutAnalyticsRouter)
  app.use('/api/admin/push-campaigns', adminPushCampaignsRouter)
  app.use('/api/admin/support', adminSupportRouter)

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  app.use((err, _req, res, _next) => {
    const status = err.status || 500
    if (status >= 500) console.error(err)
    res.status(status).json({
      error: err.status ? err.message : 'Internal server error',
    })
  })

  return app
}

const app = createApp()

export default app

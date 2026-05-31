import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import path from 'path'

import authRouter from './routes/auth.js'
import cityRouter from './routes/cities.js'
import stadiumRouter from './routes/stadiums.js'
import matchRouter from './routes/matches.js'
import teamRouter from './routes/teams.js'
import userRouter from './routes/users.js'
import registrationRouter from './routes/registrations.js'
import newsRouter from './routes/news.js'
import uploadRouter from './routes/uploads.js'
import publicRouter from './routes/public.js'
import teamHubRouter from './routes/teamHub.js'
import chatsRouter from './routes/chats.js'
import ecosystemRouter from './routes/ecosystem.js'
import sportRouter from './routes/sports.js'
import clubRouter from './routes/clubs.js'
import subscriptionPlanRouter from './routes/subscriptionPlans.js'
import subscriptionRouter from './routes/subscriptions.js'
import crmRouter from './routes/crm.js'
import { ensureDefaultSports } from './lib/defaultSports.js'
import { attachChatRealtime } from './lib/chatRealtime.js'

const app = express()
const PORT = process.env.PORT || 4000
const ADMIN_USER = process.env.ADMIN_USER || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))
// статика для изображений стадионов: кладём файлы в backend/public/uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')))

app.use('/api', publicRouter)
app.use('/api', authRouter)
app.use('/api', teamHubRouter)
app.use('/api', chatsRouter)
app.use('/api', ecosystemRouter)

// Простейшая базовая авторизация для админки
app.use('/api/admin', (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Basic ')) {
    return res.status(401).set('WWW-Authenticate', 'Basic realm="admin"').json({ error: 'Auth required' })
  }
  const decoded = Buffer.from(header.split(' ')[1] || '', 'base64').toString()
  const [user, pass] = decoded.split(':')
  if (user !== ADMIN_USER || pass !== ADMIN_PASSWORD) {
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

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

// Prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err)
  process.exit(1)
})
process.on('unhandledRejection', (reason, promise) => {
  console.error('unhandledRejection at', promise, 'reason:', reason)
  process.exit(1)
})

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`PlayGo Admin API listening on port ${PORT}`)
  ensureDefaultSports().catch((err) => {
    console.error('Default sports seed failed', err)
  })
})
attachChatRealtime(server)

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or use a different PORT.`)
  } else {
    console.error('Server error:', err)
  }
  process.exit(1)
})

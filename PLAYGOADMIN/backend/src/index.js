import app from './app.js'
import { config } from './config.js'
import { ensureDefaultSports } from './lib/defaultSports.js'
import { attachChatRealtime } from './lib/chatRealtime.js'
import { startSubscriptionExpiryJob } from './lib/subscriptionExpiry.js'
import prisma from './prisma.js'

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`PlayGo Admin API listening on port ${config.port}`)
  ensureDefaultSports().catch((err) => {
    console.error('Default sports seed failed', err)
  })
})
const realtime = attachChatRealtime(server)
const subscriptionExpiryTimer = startSubscriptionExpiryJob()

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Stop the other process or use a different PORT.`)
  } else {
    console.error('Server error:', err)
  }
  process.exit(1)
})

let isShuttingDown = false
const shutdown = (signal, exitCode = 0) => {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`${signal} received; shutting down`)

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out')
    process.exit(1)
  }, 10000)
  forceExit.unref()

  realtime.clients.forEach((client) => client.terminate())
  realtime.close()
  if (subscriptionExpiryTimer) clearInterval(subscriptionExpiryTimer)
  server.close(async (err) => {
    try {
      await prisma.$disconnect()
    } finally {
      clearTimeout(forceExit)
      process.exit(err ? 1 : exitCode)
    }
  })
}

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))
process.once('uncaughtException', (err) => {
  console.error('uncaughtException:', err)
  shutdown('uncaughtException', 1)
})
process.once('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason)
  shutdown('unhandledRejection', 1)
})

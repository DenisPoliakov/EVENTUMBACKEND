import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

let messaging
let unavailableReason

const initializeMessaging = () => {
  if (messaging) return { messaging }
  if (unavailableReason) return { unavailableReason }

  const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim()
  const applicationCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (!serviceAccountJson && !applicationCredentials) {
    unavailableReason = 'NO_CREDENTIALS'
    return { unavailableReason }
  }

  try {
    const credential = serviceAccountJson
      ? cert(JSON.parse(serviceAccountJson))
      : applicationDefault()
    const app = getApps()[0] || initializeApp({ credential })
    messaging = getMessaging(app)
    return { messaging }
  } catch (error) {
    unavailableReason = 'INVALID_CREDENTIALS'
    console.error('FCM initialization skipped:', error.message)
    return { unavailableReason, error }
  }
}

export const sendFcmMulticast = async ({ tokens, notification, data }) => {
  const initialized = initializeMessaging()
  if (!initialized.messaging) {
    return {
      configured: false,
      skippedReason: initialized.unavailableReason,
      responses: [],
    }
  }

  const response = await initialized.messaging.sendEachForMulticast({
    tokens,
    notification,
    data,
  })
  return {
    configured: true,
    responses: response.responses,
  }
}

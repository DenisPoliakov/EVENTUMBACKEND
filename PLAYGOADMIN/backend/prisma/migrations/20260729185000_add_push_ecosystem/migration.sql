-- Push delivery metadata and durable dispatch deduplication.
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');
CREATE TYPE "PushDispatchStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED');

ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_CONFIRMED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_EXPIRING';

ALTER TABLE "UserNotification"
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "data" JSONB;

CREATE UNIQUE INDEX "UserNotification_dedupeKey_key"
  ON "UserNotification"("dedupeKey");

CREATE TABLE "PushToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" "PushPlatform" NOT NULL,
  "deviceId" TEXT,
  "deviceName" TEXT,
  "appVersion" TEXT,
  "locale" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");
CREATE UNIQUE INDEX "PushToken_userId_platform_deviceId_key"
  ON "PushToken"("userId", "platform", "deviceId");
CREATE INDEX "PushToken_userId_updatedAt_idx"
  ON "PushToken"("userId", "updatedAt");

ALTER TABLE "PushToken"
  ADD CONSTRAINT "PushToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PushDispatch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notificationId" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "status" "PushDispatchStatus" NOT NULL DEFAULT 'PENDING',
  "tokenCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedReason" TEXT,
  "lastError" TEXT,
  "attemptedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushDispatch_notificationId_key"
  ON "PushDispatch"("notificationId");
CREATE UNIQUE INDEX "PushDispatch_dedupeKey_key"
  ON "PushDispatch"("dedupeKey");
CREATE INDEX "PushDispatch_userId_createdAt_idx"
  ON "PushDispatch"("userId", "createdAt");
CREATE INDEX "PushDispatch_status_createdAt_idx"
  ON "PushDispatch"("status", "createdAt");

ALTER TABLE "PushDispatch"
  ADD CONSTRAINT "PushDispatch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDispatch"
  ADD CONSTRAINT "PushDispatch_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "UserNotification"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

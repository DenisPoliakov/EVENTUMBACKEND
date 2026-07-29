ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'MANUAL_CAMPAIGN';

CREATE TYPE "PushCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'PARTIAL', 'FAILED', 'SKIPPED');
CREATE TYPE "PushTargetSegment" AS ENUM ('ALL_USERS', 'SELECTED_USERS', 'FAVORITE_CLUB');
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SupportMessageAuthor" AS ENUM ('USER', 'ADMIN');

CREATE TABLE "PushTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "imageUrl" TEXT,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushCampaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "imageUrl" TEXT,
  "data" JSONB,
  "status" "PushCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "targetSegment" "PushTargetSegment" NOT NULL,
  "selectedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "audienceUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "favoriteClubId" TEXT,
  "createdByUserId" TEXT,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "inAppCreatedCount" INTEGER NOT NULL DEFAULT 0,
  "pushSentCount" INTEGER NOT NULL DEFAULT 0,
  "pushFailedCount" INTEGER NOT NULL DEFAULT 0,
  "pushSkippedCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sendAttemptedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiMatchHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestJson" JSONB NOT NULL,
  "resultJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiMatchHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorType" "SupportMessageAuthor" NOT NULL,
  "authorUserId" TEXT,
  "body" TEXT NOT NULL,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserNotification" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "PushDispatch" ADD COLUMN "campaignId" TEXT;

CREATE UNIQUE INDEX "PushTemplate_name_key" ON "PushTemplate"("name");
CREATE INDEX "PushCampaign_status_createdAt_idx" ON "PushCampaign"("status", "createdAt");
CREATE INDEX "PushCampaign_favoriteClubId_idx" ON "PushCampaign"("favoriteClubId");
CREATE INDEX "UserNotification_campaignId_idx" ON "UserNotification"("campaignId");
CREATE INDEX "PushDispatch_campaignId_status_idx" ON "PushDispatch"("campaignId", "status");
CREATE INDEX "AiMatchHistory_userId_createdAt_idx" ON "AiMatchHistory"("userId", "createdAt");
CREATE INDEX "SupportTicket_userId_updatedAt_idx" ON "SupportTicket"("userId", "updatedAt");
CREATE INDEX "SupportTicket_status_priority_updatedAt_idx" ON "SupportTicket"("status", "priority", "updatedAt");
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

ALTER TABLE "PushCampaign" ADD CONSTRAINT "PushCampaign_favoriteClubId_fkey" FOREIGN KEY ("favoriteClubId") REFERENCES "SportClub"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PushCampaign" ADD CONSTRAINT "PushCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PushCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PushDispatch" ADD CONSTRAINT "PushDispatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PushCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiMatchHistory" ADD CONSTRAINT "AiMatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

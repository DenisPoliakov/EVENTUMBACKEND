-- Workout session synchronization
CREATE TYPE "WorkoutSessionSource" AS ENUM ('TIMER', 'MANUAL', 'IMPORTED');

CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "source" "WorkoutSessionSource" NOT NULL,
    "customPlan" JSONB,
    "clientKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutSession_userId_clientKey_key"
ON "WorkoutSession"("userId", "clientKey");
CREATE UNIQUE INDEX "WorkoutSession_userId_programId_finishedAt_key"
ON "WorkoutSession"("userId", "programId", "finishedAt");
CREATE INDEX "WorkoutSession_userId_finishedAt_idx"
ON "WorkoutSession"("userId", "finishedAt");
CREATE INDEX "WorkoutSession_programId_finishedAt_idx"
ON "WorkoutSession"("programId", "finishedAt");

ALTER TABLE "WorkoutSession"
ADD CONSTRAINT "WorkoutSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkoutSession"
ADD CONSTRAINT "WorkoutSession_programId_fkey"
FOREIGN KEY ("programId") REFERENCES "WorkoutProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- News CMS extensions and normalized, GDPR-safe analytics.
ALTER TYPE "NewsType" ADD VALUE IF NOT EXISTS 'SPONSORED';
ALTER TABLE "News" ADD COLUMN IF NOT EXISTS "clubId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'News_clubId_fkey'
  ) THEN
    ALTER TABLE "News"
    ADD CONSTRAINT "News_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "SportClub"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "News_clubId_idx" ON "News"("clubId");

CREATE TABLE "NewsView" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NewsView_newsId_idx" ON "NewsView"("newsId");
CREATE INDEX "NewsView_userId_idx" ON "NewsView"("userId");
ALTER TABLE "NewsView"
ADD CONSTRAINT "NewsView_newsId_fkey"
FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsView"
ADD CONSTRAINT "NewsView_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NewsUniqueView" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsUniqueView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsUniqueView_newsId_userId_key"
ON "NewsUniqueView"("newsId", "userId");
CREATE INDEX "NewsUniqueView_userId_idx" ON "NewsUniqueView"("userId");
ALTER TABLE "NewsUniqueView"
ADD CONSTRAINT "NewsUniqueView_newsId_fkey"
FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsUniqueView"
ADD CONSTRAINT "NewsUniqueView_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

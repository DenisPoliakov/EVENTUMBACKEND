-- AlterEnum
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'FRIEND_REQUEST';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'FRIEND_ACCEPTED';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WellnessStoryAuthorType" AS ENUM ('PLATFORM', 'COACH', 'CLUB');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);

-- AlterTable WellnessStory
ALTER TABLE "WellnessStory" ADD COLUMN IF NOT EXISTS "authorType" "WellnessStoryAuthorType" NOT NULL DEFAULT 'PLATFORM';
ALTER TABLE "WellnessStory" ADD COLUMN IF NOT EXISTS "authorUserId" TEXT;
ALTER TABLE "WellnessStory" ADD COLUMN IF NOT EXISTS "authorClubId" TEXT;
ALTER TABLE "WellnessStory" ADD COLUMN IF NOT EXISTS "coachProfileId" TEXT;

CREATE INDEX IF NOT EXISTS "WellnessStory_authorType_idx" ON "WellnessStory"("authorType");
CREATE INDEX IF NOT EXISTS "WellnessStory_authorUserId_idx" ON "WellnessStory"("authorUserId");
CREATE INDEX IF NOT EXISTS "WellnessStory_authorClubId_idx" ON "WellnessStory"("authorClubId");
CREATE INDEX IF NOT EXISTS "WellnessStory_coachProfileId_idx" ON "WellnessStory"("coachProfileId");

DO $$ BEGIN
  ALTER TABLE "WellnessStory" ADD CONSTRAINT "WellnessStory_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WellnessStory" ADD CONSTRAINT "WellnessStory_authorClubId_fkey" FOREIGN KEY ("authorClubId") REFERENCES "SportClub"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WellnessStory" ADD CONSTRAINT "WellnessStory_coachProfileId_fkey" FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

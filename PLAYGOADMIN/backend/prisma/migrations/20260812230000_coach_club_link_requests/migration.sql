-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CoachClubLinkRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CoachClubLinkRequest" (
    "id" TEXT NOT NULL,
    "coachProfileId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "status" "CoachClubLinkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachClubLinkRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoachClubLinkRequest_coachProfileId_status_idx" ON "CoachClubLinkRequest"("coachProfileId", "status");
CREATE INDEX IF NOT EXISTS "CoachClubLinkRequest_clubId_status_idx" ON "CoachClubLinkRequest"("clubId", "status");
CREATE INDEX IF NOT EXISTS "CoachClubLinkRequest_status_createdAt_idx" ON "CoachClubLinkRequest"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "CoachClubLinkRequest" ADD CONSTRAINT "CoachClubLinkRequest_coachProfileId_fkey" FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoachClubLinkRequest" ADD CONSTRAINT "CoachClubLinkRequest_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "SportClub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

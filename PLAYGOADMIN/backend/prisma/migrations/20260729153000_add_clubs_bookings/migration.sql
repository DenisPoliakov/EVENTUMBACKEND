CREATE TYPE "ClubTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');
CREATE TYPE "TrainingBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "SportClub"
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "tier" "ClubTier" NOT NULL DEFAULT 'BRONZE';

UPDATE "SportClub" SET "logoUrl" = "imageUrl" WHERE "logoUrl" IS NULL;

ALTER TABLE "ClubSchedule"
  ADD COLUMN "coachProfileId" TEXT,
  ADD COLUMN "priceCents" INTEGER NOT NULL DEFAULT 50000;

ALTER TABLE "MembershipPlan"
  ADD COLUMN "tier" "ClubTier";

CREATE TABLE "TrainingBooking" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "scheduleEntryId" TEXT,
  "coachProfileId" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "scheduleTitle" TEXT NOT NULL,
  "note" TEXT,
  "priceCents" INTEGER NOT NULL,
  "platformFeeCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "status" "TrainingBookingStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingBooking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClubSchedule_coachProfileId_idx" ON "ClubSchedule"("coachProfileId");
CREATE INDEX "MembershipPlan_tier_idx" ON "MembershipPlan"("tier");
CREATE INDEX "TrainingBooking_userId_scheduledAt_idx" ON "TrainingBooking"("userId", "scheduledAt");
CREATE INDEX "TrainingBooking_clubId_scheduledAt_idx" ON "TrainingBooking"("clubId", "scheduledAt");
CREATE INDEX "TrainingBooking_scheduleEntryId_idx" ON "TrainingBooking"("scheduleEntryId");
CREATE INDEX "TrainingBooking_coachProfileId_idx" ON "TrainingBooking"("coachProfileId");
CREATE INDEX "TrainingBooking_status_idx" ON "TrainingBooking"("status");

ALTER TABLE "ClubSchedule"
  ADD CONSTRAINT "ClubSchedule_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrainingBooking"
  ADD CONSTRAINT "TrainingBooking_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingBooking"
  ADD CONSTRAINT "TrainingBooking_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "SportClub"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingBooking"
  ADD CONSTRAINT "TrainingBooking_scheduleEntryId_fkey"
  FOREIGN KEY ("scheduleEntryId") REFERENCES "ClubSchedule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrainingBooking"
  ADD CONSTRAINT "TrainingBooking_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

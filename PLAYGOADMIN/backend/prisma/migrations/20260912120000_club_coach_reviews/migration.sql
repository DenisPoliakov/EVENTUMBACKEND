-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('CLUB', 'COACH');

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "targetType" "ReviewTargetType" NOT NULL,
    "clubId" TEXT,
    "coachProfileId" TEXT,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_clubId_createdAt_idx" ON "Review"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_coachProfileId_createdAt_idx" ON "Review"("coachProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_targetType_createdAt_idx" ON "Review"("targetType", "createdAt");

-- CreateIndex
CREATE INDEX "Review_isHidden_createdAt_idx" ON "Review"("isHidden", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_authorUserId_clubId_key" ON "Review"("authorUserId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_authorUserId_coachProfileId_key" ON "Review"("authorUserId", "coachProfileId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "SportClub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_coachProfileId_fkey" FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

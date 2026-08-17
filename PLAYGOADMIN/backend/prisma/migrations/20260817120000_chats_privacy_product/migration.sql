-- CreateEnum
CREATE TYPE "EventumProduct" AS ENUM ('FOOTBALL', 'CLUBS');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');

-- AlterTable User privacy
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hideEmail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hidePhone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hideBirthDate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hideCity" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hideCoachContacts" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable DirectChat product + soft-delete + self-chat
ALTER TABLE "DirectChat" ADD COLUMN IF NOT EXISTS "productCode" "EventumProduct" NOT NULL DEFAULT 'FOOTBALL';
ALTER TABLE "DirectChat" ADD COLUMN IF NOT EXISTS "isSelfChat" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DirectChat" ADD COLUMN IF NOT EXISTS "userADeletedAt" TIMESTAMP(3);
ALTER TABLE "DirectChat" ADD COLUMN IF NOT EXISTS "userBDeletedAt" TIMESTAMP(3);

-- AlterTable ChatMessage edit/delete
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Backfill: chats involving a boxing/clubs coach → CLUBS
UPDATE "DirectChat" AS dc
SET "productCode" = 'CLUBS'
WHERE EXISTS (
  SELECT 1
  FROM "CoachProfile" AS cp
  LEFT JOIN "SportClub" AS sc ON sc.id = cp."clubId"
  LEFT JOIN "Sport" AS s ON s.id = sc."sportId"
  WHERE (cp."userId" = dc."userAId" OR cp."userId" = dc."userBId")
    AND (
      s.code = 'BOXING'
      OR cp."clubId" IS NOT NULL
    )
);

-- Replace unique constraint (userA, userB) → (userA, userB, product)
ALTER TABLE "DirectChat" DROP CONSTRAINT IF EXISTS "DirectChat_userAId_userBId_key";
DROP INDEX IF EXISTS "DirectChat_userAId_userBId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "DirectChat_userAId_userBId_productCode_key"
  ON "DirectChat"("userAId", "userBId", "productCode");

CREATE INDEX IF NOT EXISTS "DirectChat_userAId_productCode_updatedAt_idx"
  ON "DirectChat"("userAId", "productCode", "updatedAt");
CREATE INDEX IF NOT EXISTS "DirectChat_userBId_productCode_updatedAt_idx"
  ON "DirectChat"("userBId", "productCode", "updatedAt");
CREATE INDEX IF NOT EXISTS "DirectChat_productCode_updatedAt_idx"
  ON "DirectChat"("productCode", "updatedAt");

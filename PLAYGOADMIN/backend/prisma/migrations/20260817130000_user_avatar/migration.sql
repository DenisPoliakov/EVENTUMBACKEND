-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- Backfill from player cards when user has no avatar yet
UPDATE "User" AS u
SET "avatarUrl" = pc."avatarUrl"
FROM "PlayerCard" AS pc
WHERE pc."userId" = u.id
  AND u."avatarUrl" IS NULL
  AND pc."avatarUrl" IS NOT NULL
  AND pc."avatarUrl" <> '';

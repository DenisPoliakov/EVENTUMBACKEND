-- Remove contact verification leftovers if they were applied earlier.
DROP TABLE IF EXISTS "ContactVerification";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerifiedAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phoneVerifiedAt";
DROP TYPE IF EXISTS "VerificationChannel";

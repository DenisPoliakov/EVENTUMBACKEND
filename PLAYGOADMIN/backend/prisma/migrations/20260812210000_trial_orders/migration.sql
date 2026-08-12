-- AlterEnum
ALTER TYPE "OrderType" ADD VALUE IF NOT EXISTS 'TRIAL';

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "scheduleEntryId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_scheduleEntryId_idx" ON "Order"("scheduleEntryId");

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_scheduleEntryId_fkey" FOREIGN KEY ("scheduleEntryId") REFERENCES "ClubSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable TrainingBooking
ALTER TABLE "TrainingBooking" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "TrainingBooking_orderId_key" ON "TrainingBooking"("orderId");

DO $$ BEGIN
  ALTER TABLE "TrainingBooking" ADD CONSTRAINT "TrainingBooking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

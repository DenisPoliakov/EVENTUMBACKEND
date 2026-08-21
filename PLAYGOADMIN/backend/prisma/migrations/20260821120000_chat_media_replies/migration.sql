-- AlterEnum
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'IMAGE';
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'VOICE';
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'VIDEO';
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'VIDEO_NOTE';
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'ALBUM';

-- AlterTable
ALTER TABLE "ChatMessage" ALTER COLUMN "text" SET DEFAULT '';
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToMessageId" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "mediaMimeTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "mediaBytes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "width" INTEGER;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "height" INTEGER;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "isRound" BOOLEAN NOT NULL DEFAULT false;

-- ForeignKey for reply
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_replyToMessageId_fkey'
  ) THEN
    ALTER TABLE "ChatMessage"
      ADD CONSTRAINT "ChatMessage_replyToMessageId_fkey"
      FOREIGN KEY ("replyToMessageId") REFERENCES "ChatMessage"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ChatMessage_replyToMessageId_idx" ON "ChatMessage"("replyToMessageId");

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "hiddenForUserAAt" TIMESTAMP(3),
ADD COLUMN     "hiddenForUserBAt" TIMESTAMP(3),
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "ChatMessage_chatId_pinnedAt_idx" ON "ChatMessage"("chatId", "pinnedAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_pinnedByUserId_fkey" FOREIGN KEY ("pinnedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "WellnessStoryCategory" AS ENUM ('NUTRITION', 'WARMUP', 'ROUTINE', 'WORKOUTS', 'BALANCE');

-- CreateTable
CREATE TABLE "WellnessStory" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "WellnessStoryCategory" NOT NULL,
    "coverImageUrl" TEXT,
    "readMinutes" INTEGER NOT NULL DEFAULT 3,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessStoryView" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellnessStoryView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WellnessStory_slug_key" ON "WellnessStory"("slug");

-- CreateIndex
CREATE INDEX "WellnessStory_locale_isActive_deletedAt_sortOrder_idx"
ON "WellnessStory"("locale", "isActive", "deletedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "WellnessStory_publishedAt_idx" ON "WellnessStory"("publishedAt");

-- CreateIndex
CREATE INDEX "WellnessStoryView_userId_idx" ON "WellnessStoryView"("userId");

-- CreateIndex
CREATE INDEX "WellnessStoryView_storyId_idx" ON "WellnessStoryView"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessStoryView_storyId_userId_key"
ON "WellnessStoryView"("storyId", "userId");

-- AddForeignKey
ALTER TABLE "WellnessStoryView"
ADD CONSTRAINT "WellnessStoryView_storyId_fkey"
FOREIGN KEY ("storyId") REFERENCES "WellnessStory"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessStoryView"
ADD CONSTRAINT "WellnessStoryView_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

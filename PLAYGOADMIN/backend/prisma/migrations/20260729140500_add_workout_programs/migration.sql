-- CreateEnum
CREATE TYPE "WorkoutPhase" AS ENUM ('WARMUP', 'WORK', 'REST', 'COOLDOWN');

-- CreateTable
CREATE TABLE "WorkoutProgram" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "guide" TEXT,
    "iconKey" TEXT,
    "gradientStart" TEXT,
    "gradientEnd" TEXT,
    "estimatedMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutStep" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "phase" "WorkoutPhase" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "illustrationUrl" TEXT,
    "poseIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutProgramView" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutProgramView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutProgram_locale_isActive_sortOrder_idx" ON "WorkoutProgram"("locale", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutStep_programId_order_key" ON "WorkoutStep"("programId", "order");

-- CreateIndex
CREATE INDEX "WorkoutStep_programId_idx" ON "WorkoutStep"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutProgramView_programId_userId_key" ON "WorkoutProgramView"("programId", "userId");

-- CreateIndex
CREATE INDEX "WorkoutProgramView_userId_idx" ON "WorkoutProgramView"("userId");

-- CreateIndex
CREATE INDEX "WorkoutProgramView_programId_idx" ON "WorkoutProgramView"("programId");

-- AddForeignKey
ALTER TABLE "WorkoutStep" ADD CONSTRAINT "WorkoutStep_programId_fkey" FOREIGN KEY ("programId") REFERENCES "WorkoutProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgramView" ADD CONSTRAINT "WorkoutProgramView_programId_fkey" FOREIGN KEY ("programId") REFERENCES "WorkoutProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgramView" ADD CONSTRAINT "WorkoutProgramView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

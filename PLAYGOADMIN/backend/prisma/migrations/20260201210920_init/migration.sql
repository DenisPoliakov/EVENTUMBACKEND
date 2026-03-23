/*
  Warnings:

  - A unique constraint covering the columns `[matchId,teamName]` on the table `MatchRegistration` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `captainLogin` to the `MatchRegistration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `captainName` to the `MatchRegistration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cityId` to the `MatchRegistration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stadiumId` to the `MatchRegistration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teamName` to the `MatchRegistration` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MatchRegistration" DROP CONSTRAINT "MatchRegistration_teamId_fkey";

-- DropIndex
DROP INDEX "MatchRegistration_matchId_teamId_key";

-- AlterTable
ALTER TABLE "MatchRegistration" ADD COLUMN     "captainLogin" TEXT NOT NULL,
ADD COLUMN     "captainName" TEXT NOT NULL,
ADD COLUMN     "cityId" TEXT NOT NULL,
ADD COLUMN     "stadiumId" TEXT NOT NULL,
ADD COLUMN     "teamName" TEXT NOT NULL,
ALTER COLUMN "teamId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MatchRegistration_matchId_teamName_key" ON "MatchRegistration"("matchId", "teamName");

-- AddForeignKey
ALTER TABLE "MatchRegistration" ADD CONSTRAINT "MatchRegistration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

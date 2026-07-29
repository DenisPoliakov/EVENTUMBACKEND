ALTER TYPE "OrderType" ADD VALUE 'PREMIUM';

ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "Order" ALTER COLUMN "planId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "premiumPlanId" TEXT;
ALTER TABLE "Order" ADD COLUMN "premiumSubscriptionId" TEXT;

CREATE TABLE "AppPremiumPlan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL DEFAULT 29900,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "durationDays" INTEGER NOT NULL DEFAULT 30,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppPremiumPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppPremiumSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppPremiumSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralRedemption" (
  "id" TEXT NOT NULL,
  "referrerUserId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE UNIQUE INDEX "AppPremiumPlan_code_key" ON "AppPremiumPlan"("code");
CREATE INDEX "AppPremiumSubscription_userId_status_expiresAt_idx" ON "AppPremiumSubscription"("userId", "status", "expiresAt");
CREATE INDEX "AppPremiumSubscription_planId_idx" ON "AppPremiumSubscription"("planId");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
CREATE UNIQUE INDEX "ReferralRedemption_referredUserId_key" ON "ReferralRedemption"("referredUserId");
CREATE INDEX "ReferralRedemption_referrerUserId_idx" ON "ReferralRedemption"("referrerUserId");
CREATE UNIQUE INDEX "Order_premiumSubscriptionId_key" ON "Order"("premiumSubscriptionId");
CREATE INDEX "Order_premiumPlanId_idx" ON "Order"("premiumPlanId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_premiumPlanId_fkey" FOREIGN KEY ("premiumPlanId") REFERENCES "AppPremiumPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_premiumSubscriptionId_fkey" FOREIGN KEY ("premiumSubscriptionId") REFERENCES "AppPremiumSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppPremiumSubscription" ADD CONSTRAINT "AppPremiumSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppPremiumSubscription" ADD CONSTRAINT "AppPremiumSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AppPremiumPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

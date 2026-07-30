CREATE TYPE "PremiumCreditTransactionType" AS ENUM (
  'REFERRAL_REWARD',
  'PREMIUM_PURCHASE',
  'ADMIN_ADJUSTMENT',
  'REVERSAL'
);

ALTER TABLE "ReferralRedemption"
  ADD COLUMN "referrerRewardCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "referredBonusDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rewardedAt" TIMESTAMP(3),
  ADD COLUMN "bonusSubscriptionId" TEXT;

CREATE UNIQUE INDEX "ReferralRedemption_bonusSubscriptionId_key"
  ON "ReferralRedemption"("bonusSubscriptionId");

CREATE TABLE "PremiumCreditAccount" (
  "userId" TEXT,
  "balanceCents" INTEGER NOT NULL DEFAULT 0,
  "earnedCents" INTEGER NOT NULL DEFAULT 0,
  "spentCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PremiumCreditAccount_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "PremiumCreditAccount_nonnegative_check"
    CHECK ("balanceCents" >= 0 AND "earnedCents" >= 0 AND "spentCents" >= 0)
);

CREATE TABLE "PremiumCreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "PremiumCreditTransactionType" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "balanceAfterCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "idempotencyKey" TEXT NOT NULL,
  "referralRedemptionId" TEXT,
  "orderId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PremiumCreditTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PremiumCreditTransaction_balance_check"
    CHECK ("balanceAfterCents" >= 0)
);

CREATE UNIQUE INDEX "PremiumCreditTransaction_idempotencyKey_key"
  ON "PremiumCreditTransaction"("idempotencyKey");
CREATE UNIQUE INDEX "PremiumCreditTransaction_referralRedemptionId_key"
  ON "PremiumCreditTransaction"("referralRedemptionId");
CREATE UNIQUE INDEX "PremiumCreditTransaction_orderId_key"
  ON "PremiumCreditTransaction"("orderId");
CREATE INDEX "PremiumCreditTransaction_userId_createdAt_idx"
  ON "PremiumCreditTransaction"("userId", "createdAt");
CREATE INDEX "PremiumCreditTransaction_type_createdAt_idx"
  ON "PremiumCreditTransaction"("type", "createdAt");

ALTER TABLE "ReferralRedemption"
  ADD CONSTRAINT "ReferralRedemption_bonusSubscriptionId_fkey"
  FOREIGN KEY ("bonusSubscriptionId")
  REFERENCES "AppPremiumSubscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PremiumCreditAccount"
  ADD CONSTRAINT "PremiumCreditAccount_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PremiumCreditTransaction"
  ADD CONSTRAINT "PremiumCreditTransaction_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "PremiumCreditAccount"("userId")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PremiumCreditTransaction"
  ADD CONSTRAINT "PremiumCreditTransaction_referralRedemptionId_fkey"
  FOREIGN KEY ("referralRedemptionId")
  REFERENCES "ReferralRedemption"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PremiumCreditTransaction"
  ADD CONSTRAINT "PremiumCreditTransaction_orderId_fkey"
  FOREIGN KEY ("orderId")
  REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

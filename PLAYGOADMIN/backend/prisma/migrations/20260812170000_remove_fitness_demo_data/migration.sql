CREATE TEMP TABLE "_FitnessCleanupSports" ON COMMIT DROP AS
SELECT "id"
FROM "Sport"
WHERE UPPER("code") = 'FITNESS';

CREATE TEMP TABLE "_FitnessCleanupClubs" ON COMMIT DROP AS
SELECT "id"
FROM "SportClub"
WHERE "sportId" IN (SELECT "id" FROM "_FitnessCleanupSports")
   OR "contactEmail" IN (
     'moscow-football@eventum.demo',
     'spb-football@eventum.demo'
   );

CREATE TEMP TABLE "_FitnessCleanupPlans" ON COMMIT DROP AS
SELECT "id"
FROM "MembershipPlan"
WHERE "sportId" IN (SELECT "id" FROM "_FitnessCleanupSports")
   OR "clubId" IN (SELECT "id" FROM "_FitnessCleanupClubs");

CREATE TEMP TABLE "_FitnessCleanupOrders" ON COMMIT DROP AS
SELECT "id"
FROM "Order"
WHERE "sportId" IN (SELECT "id" FROM "_FitnessCleanupSports")
   OR "clubId" IN (SELECT "id" FROM "_FitnessCleanupClubs")
   OR "planId" IN (SELECT "id" FROM "_FitnessCleanupPlans");

DELETE FROM "Payment"
WHERE "orderId" IN (SELECT "id" FROM "_FitnessCleanupOrders");

DELETE FROM "Order"
WHERE "id" IN (SELECT "id" FROM "_FitnessCleanupOrders");

DELETE FROM "UserSubscription"
WHERE "sportId" IN (SELECT "id" FROM "_FitnessCleanupSports")
   OR "clubId" IN (SELECT "id" FROM "_FitnessCleanupClubs")
   OR "planId" IN (SELECT "id" FROM "_FitnessCleanupPlans");

DELETE FROM "MembershipPlan"
WHERE "id" IN (SELECT "id" FROM "_FitnessCleanupPlans");

DELETE FROM "TrainingBooking"
WHERE "clubId" IN (SELECT "id" FROM "_FitnessCleanupClubs");

DELETE FROM "ClubSchedule"
WHERE "clubId" IN (SELECT "id" FROM "_FitnessCleanupClubs");

DELETE FROM "FavoriteClub"
WHERE "clubId" IN (SELECT "id" FROM "_FitnessCleanupClubs");

UPDATE "CoachProfile"
SET "clubId" = NULL
WHERE "clubId" IN (SELECT "id" FROM "_FitnessCleanupClubs");

UPDATE "News"
SET "clubId" = NULL
WHERE "clubId" IN (SELECT "id" FROM "_FitnessCleanupClubs");

UPDATE "UserNotification"
SET "clubId" = NULL
WHERE "clubId" IN (SELECT "id" FROM "_FitnessCleanupClubs");

UPDATE "PushCampaign"
SET "favoriteClubId" = NULL
WHERE "favoriteClubId" IN (SELECT "id" FROM "_FitnessCleanupClubs");

DELETE FROM "SportClub"
WHERE "id" IN (SELECT "id" FROM "_FitnessCleanupClubs");

DELETE FROM "Sport"
WHERE "id" IN (SELECT "id" FROM "_FitnessCleanupSports");

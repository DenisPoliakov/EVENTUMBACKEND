# Backend operations

## Production configuration

Set `NODE_ENV=production`, `DATABASE_URL`, a random `JWT_SECRET` of at least
32 characters, non-default `ADMIN_USER` and `ADMIN_PASSWORD` (at least 12
characters), and a comma-separated `CORS_ORIGINS` allowlist. The process exits
at startup when production credentials or origins are missing.

`GET /api/health` checks PostgreSQL and returns HTTP 503 with
`status: "degraded"` when the database is unavailable. SIGTERM and SIGINT stop
HTTP/WebSocket traffic and disconnect Prisma before exit.

## Migration baseline and current drift

Do not run `prisma migrate reset` against any shared or user database. Take a
database backup before resolving migration history.

The checked-in history currently contains three early `init` directories and
the later wellness migration. The Prisma schema contains additional legacy
models that those migrations do not fully recreate. Therefore, a fresh
`prisma migrate deploy` is not yet a complete schema bootstrap, and migration
directories must not be marked applied merely to silence `migrate status`.

For each existing environment:

1. Run `npx prisma migrate status` and save the output.
2. Compare the live schema with `prisma/schema.prisma` using a read-only dump
   or `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`.
3. For each checked-in migration whose SQL is already represented in the live
   schema, record it without executing SQL, in chronological order:
   `npx prisma migrate resolve --applied <migration-directory>`.
4. If a migration is not represented, stop and review its SQL before using
   `npx prisma migrate deploy`. Never resolve an unapplied schema change.

To finish the baseline, use a disposable PostgreSQL database (never a user
database), apply the checked-in migrations, then generate a new,
timestamp-prefixed reconciliation migration with:

```sh
DATABASE_URL="<disposable-db>" npx prisma migrate dev --name reconcile_legacy_schema --create-only
```

Review that SQL against a fresh database and a copy of production. On an
existing database that already has all reconciled objects, mark that new
migration applied only after verification. On a fresh database, verify that
`npx prisma migrate deploy` runs every migration sequentially and that
`npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code`
reports no difference.

All future migrations must use a later timestamp, be generated from the
current schema, and be tested from both a fresh database and a production-like
backup before deployment.

## Tests

`npm test` always runs foundation tests. Database/wellness tests are read-only
and skip unless `TEST_DATABASE_URL` points to a dedicated test database. The
test harness never resets or cleans a database.

Run `npm run check` for JavaScript syntax checks and `prisma validate`.

## Push notifications

Apply `20260729185000_add_push_ecosystem` additively with the normal reviewed
migration process; never reset an existing database. FCM is optional. Set
either `FCM_SERVICE_ACCOUNT_JSON` to the complete single-line Firebase service
account JSON or `GOOGLE_APPLICATION_CREDENTIALS` to a readable service-account
file. The service account needs Firebase Cloud Messaging send access and the
Firebase project must have Cloud Messaging enabled.

Without credentials, in-app notifications are still persisted and each push
dispatch is recorded as `SKIPPED` with `NO_CREDENTIALS`. Invalid/unregistered
FCM registration tokens are deleted after Firebase rejects them.

Subscription-expiry scanning is disabled in-process by default. Set
`PUSH_EXPIRY_INTERVAL_MINUTES` to a positive value to run it at startup and on
that interval. `PUSH_EXPIRY_WINDOW_DAYS` defaults to 7 and
`PUSH_EXPIRY_BATCH_SIZE` defaults to 250 per subscription kind. An external
scheduler can instead invoke the exported function:

```sh
node --input-type=module -e \
  "import { runSubscriptionExpiryNotifications as run } from './src/lib/subscriptionExpiry.js'; import prisma from './src/prisma.js'; await run(); await prisma.\$disconnect()"
```

Notification and dispatch dedupe keys include the source record (and the
expiry timestamp for subscriptions), so overlapping job runs and restarts do
not create duplicates.

Apply `20260729200000_add_optional_production` additively after the push
ecosystem migration. It adds manual campaign/templates, caller-supplied AI
match history, and support ticket tables. Review with `prisma migrate diff`
and use `prisma migrate deploy`; never reset a shared database.

Manual campaigns are sent explicitly from the admin panel; no scheduler is
required. Preview resolves only unblocked users and sending is refused above
2,000 recipients. A campaign creates durable in-app notifications and durable
per-user push dispatches. It is `SENT` only when FCM reports delivery and no
dispatch failed/skipped. Missing credentials produce `SKIPPED` with zero push
successes. Retrying a skipped/failed campaign reuses dedupe keys instead of
creating duplicate notifications.

Production still requires external Firebase project/service-account
provisioning and mobile push-token registration. YooKassa credentials and
webhook routing remain separate external requirements. Apply the production
migration only after backup and review; this repository does not provision
those services or deploy mobile integration.

## Upload risk

The generic admin upload and wellness cover endpoints enforce a 5 MB image
limit and allow JPEG, PNG, WebP, and GIF MIME types. Legacy player-card and
coach-profile upload handlers still accept arbitrary size/extensions and
write to publicly served storage. Keep those routes behind authentication,
apply reverse-proxy request limits, and prioritize moving them to the same
validated upload policy plus content inspection/object storage.

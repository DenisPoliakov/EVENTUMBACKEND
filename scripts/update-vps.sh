#!/usr/bin/env bash
set -euo pipefail
APP=/opt/eventum
BACKEND="$APP/PLAYGOADMIN/backend"
ADMIN="$APP/PLAYGOADMIN/admin"

echo "==> pull"
cd "$APP"
git fetch --depth=1 origin main
git reset --hard origin/main

echo "==> backend deps + schema"
cd "$BACKEND"
npm install
npx prisma generate
npx prisma db push --accept-data-loss
mkdir -p public/uploads/avatars public/uploads/players

echo "==> admin build"
cd "$ADMIN"
npm install
export NODE_OPTIONS=--max-old-space-size=512
VITE_API_URL=/api/admin npm run build

echo "==> pm2 restart"
cd "$BACKEND"
pm2 restart eventum-api --update-env || pm2 start src/index.js --name eventum-api --cwd "$BACKEND" --time
pm2 save
sleep 2

echo "==> health"
curl -sS "http://127.0.0.1:4000/api/health"; echo
curl -sS -o /dev/null -w "docs:%{http_code}\n" "http://127.0.0.1:8080/api/docs/" || true
curl -sS -o /dev/null -w "admin:%{http_code}\n" "http://127.0.0.1:8080/"
pm2 status
echo "==> DONE $(git -C "$APP" rev-parse --short HEAD)"

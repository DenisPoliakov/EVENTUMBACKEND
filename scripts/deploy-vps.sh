#!/usr/bin/env bash
# EVENTUM VPS bootstrap — safe alongside existing skypay stack
set -euo pipefail

APP_ROOT=/opt/eventum
REPO_URL=https://github.com/DenisPoliakov/EVENTUMBACKEND.git
BACKEND_DIR="$APP_ROOT/PLAYGOADMIN/backend"
ADMIN_DIR="$APP_ROOT/PLAYGOADMIN/admin"
PUBLIC_HOST=eventum.92-246-76-150.sslip.io
PUBLIC_HTTP=http://${PUBLIC_HOST}
PUBLIC_PORT_SITE=8080
API_PORT=4000
DB_NAME=eventum
DB_USER=eventum
ENV_FILE="$BACKEND_DIR/.env"

export DEBIAN_FRONTEND=noninteractive

echo "==> [1/9] Swap (low-RAM VPS)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon --show || true
free -h

echo "==> [2/9] Packages: postgres, build tools, pm2"
apt-get update -y
apt-get install -y postgresql postgresql-contrib build-essential curl ca-certificates
npm install -g pm2@latest

echo "==> [3/9] PostgreSQL role + database"
systemctl enable --now postgresql
# Low-memory postgres tuning (idempotent-ish)
PG_CONF=$(ls /etc/postgresql/*/main/postgresql.conf | head -1)
if [[ -f "$PG_CONF" ]]; then
  sed -i "s/^#*shared_buffers.*/shared_buffers = 64MB/" "$PG_CONF"
  sed -i "s/^#*work_mem.*/work_mem = 4MB/" "$PG_CONF"
  sed -i "s/^#*maintenance_work_mem.*/maintenance_work_mem = 32MB/" "$PG_CONF"
  sed -i "s/^#*effective_cache_size.*/effective_cache_size = 256MB/" "$PG_CONF"
  systemctl restart postgresql
fi

if [[ ! -f /root/.eventum_db_password ]]; then
  openssl rand -base64 24 | tr -d '/+=' | head -c 32 > /root/.eventum_db_password
  chmod 600 /root/.eventum_db_password
fi
DB_PASS=$(cat /root/.eventum_db_password)

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "ALTER SCHEMA public OWNER TO ${DB_USER};"

echo "==> [4/9] Clone / update repo"
mkdir -p /opt
if [[ -d "$APP_ROOT/.git" ]]; then
  git -C "$APP_ROOT" fetch --depth=1 origin main
  git -C "$APP_ROOT" reset --hard origin/main
else
  rm -rf "$APP_ROOT"
  git clone --depth=1 --branch main "$REPO_URL" "$APP_ROOT"
fi

echo "==> [5/9] Backend .env"
if [[ ! -f /root/.eventum_jwt ]]; then
  openssl rand -base64 48 | tr -d '\n' > /root/.eventum_jwt
  chmod 600 /root/.eventum_jwt
fi
if [[ ! -f /root/.eventum_admin_password ]]; then
  openssl rand -base64 18 | tr -d '/+=' | head -c 20 > /root/.eventum_admin_password
  chmod 600 /root/.eventum_admin_password
fi
JWT_SECRET=$(cat /root/.eventum_jwt)
ADMIN_PASSWORD=$(cat /root/.eventum_admin_password)
ADMIN_USER=admin

cat > "$ENV_FILE" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public"
NODE_ENV=production
PORT=${API_PORT}
ADMIN_USER=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ACCESS_TOKEN_TTL_SECONDS=86400
REFRESH_TOKEN_TTL_SECONDS=2592000
CORS_ORIGINS=${PUBLIC_HTTP},http://92.246.76.150:${PUBLIC_PORT_SITE},http://${PUBLIC_HOST}:${PUBLIC_PORT_SITE}
JSON_BODY_LIMIT=256kb
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=60
YOOKASSA_RETURN_URL=${PUBLIC_HTTP}/payments/return
PREMIUM_PRICE_CENTS=29900
PREMIUM_DURATION_DAYS=30
PREMIUM_CURRENCY=RUB
PUSH_EXPIRY_INTERVAL_MINUTES=60
NOMINATIM_USER_AGENT="EventumClubs/1.0 (https://github.com/DenisPoliakov/EVENTUMBACKEND)"
DEMO_USER_COUNT=12
DEMO_PASSWORD=Demo123!
ALLOW_PRODUCTION_DEMO_SEED=true
EOF
chmod 600 "$ENV_FILE"

echo "==> [6/9] npm install + prisma + seed"
cd "$BACKEND_DIR"
npm ci --omit=dev || npm install --omit=dev
# prisma CLI is often in devDependencies; ensure available for generate/push/seed
npm install prisma@5.19.0 --no-save
npx prisma generate
npx prisma db push --accept-data-loss
ALLOW_PRODUCTION_DEMO_SEED=true npx prisma db seed || true

echo "==> [7/9] Build admin"
cd "$ADMIN_DIR"
npm ci || npm install
export NODE_OPTIONS=--max-old-space-size=512
# Same-origin relative API so admin works on :8080 and on sslip.io host
VITE_API_URL=/api/admin npm run build

echo "==> [8/9] PM2 process"
mkdir -p "$BACKEND_DIR/public/uploads"
cd "$BACKEND_DIR"
pm2 delete eventum-api 2>/dev/null || true
pm2 start src/index.js --name eventum-api --cwd "$BACKEND_DIR" --time
pm2 save
pm2 startup systemd -u root --hp /root | tail -n 1 | bash || true

echo "==> [9/9] Nginx (port ${PUBLIC_PORT_SITE} + host ${PUBLIC_HOST})"
cat > /etc/nginx/sites-available/eventum <<'NGINX'
# EVENTUM — does not replace skypay (sky-pay.online / sslip.io)
upstream eventum_api {
    server 127.0.0.1:4000;
    keepalive 8;
}

server {
    listen 8080 default_server;
    listen [::]:8080 default_server;
    server_name eventum.92-246-76-150.sslip.io _;

    client_max_body_size 25m;

    root /opt/eventum/PLAYGOADMIN/admin/dist;
    index index.html;

    location /api/ {
        proxy_pass http://eventum_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }

    location /uploads/ {
        proxy_pass http://eventum_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /assets/ {
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store";
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name eventum.92-246-76-150.sslip.io;

    client_max_body_size 25m;

    root /opt/eventum/PLAYGOADMIN/admin/dist;
    index index.html;

    location /api/ {
        proxy_pass http://eventum_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }

    location /uploads/ {
        proxy_pass http://eventum_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /assets/ {
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store";
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/eventum /etc/nginx/sites-enabled/eventum
nginx -t
systemctl reload nginx

# ufw if present
if command -v ufw >/dev/null 2>&1; then
  ufw allow 8080/tcp || true
fi

sleep 2
echo "==> Health checks"
curl -sS "http://127.0.0.1:${API_PORT}/api/health" || curl -sS "http://127.0.0.1:${API_PORT}/api/public/health" || true
echo
curl -sS -o /dev/null -w "admin-via-8080 HTTP %{http_code}\n" "http://127.0.0.1:${PUBLIC_PORT_SITE}/"
curl -sS -o /dev/null -w "api-via-8080 HTTP %{http_code}\n" "http://127.0.0.1:${PUBLIC_PORT_SITE}/api/health" || true
pm2 status

echo
echo "======== EVENTUM DEPLOYED ========"
echo "Admin UI:  http://92.246.76.150:${PUBLIC_PORT_SITE}/"
echo "Admin UI:  ${PUBLIC_HTTP}/  (Host: ${PUBLIC_HOST})"
echo "API:       http://92.246.76.150:${PUBLIC_PORT_SITE}/api/"
echo "Admin login user: ${ADMIN_USER}"
echo "Admin login pass: ${ADMIN_PASSWORD}"
echo "(also stored in /root/.eventum_admin_password)"
echo "Demo user (if seed ok): demo_user_01 / Demo123!"
echo "================================="

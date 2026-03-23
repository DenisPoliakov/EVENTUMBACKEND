# PlayGo Admin Architecture (React + Node.js)

Дата: 1 февраля 2026

## Бэкенд
- Node.js + Express, Prisma + PostgreSQL.
- REST API, CORS открыт для админ-сайта, логирование через morgan.
- Базовая авторизация для админки: Basic auth (`ADMIN_USER`/`ADMIN_PASSWORD`), по умолчанию admin/admin.
- Env: `DATABASE_URL`, `PORT` (по умолчанию 4000), `ADMIN_USER`, `ADMIN_PASSWORD`.

### Структура
```
backend/
  src/
    index.js           # точка входа API
    prisma.js          # PrismaClient singleton
    routes/            # CRUD роутеры
  prisma/schema.prisma # схема БД
  .env.example
```

### Модель данных (Prisma)
- City: города, уникальное `name`.
- Stadium: принадлежит City, уникальная пара (cityId, name), координаты lat/long, imageUrl.
- Match: принадлежит Stadium, поля start/end, format (5x5/7x7/11x11), maxTeams, priceCents, currency, status (draft/open/full/finished/cancelled), description.
- User: роли ADMIN/USER, опциональный cityId.
- Team: принадлежит City, капитан — User, уникальная пара (cityId, name).
- TeamMember: связь team-user, роли CAPTAIN/MEMBER.
- MatchRegistration: связь team-match, статус pending/approved/rejected.

### Таблицы и связи (SQL-эквивалент)
```
Cities(id PK, name unique, created_at, updated_at)
Stadiums(id PK, city_id FK Cities, name, address, description, latitude, longitude, image_url, created_at, updated_at,
         unique(city_id, name))
Matches(id PK, stadium_id FK Stadiums, start_time, end_time, format, max_teams, price_cents, currency, status, description,
        created_at, updated_at)
Users(id PK, email unique, name, password_hash, role, city_id FK Cities, created_at, updated_at)
Teams(id PK, city_id FK Cities, captain_user_id FK Users, name, created_at, updated_at,
      unique(city_id, name))
TeamMembers(id PK, team_id FK Teams, user_id FK Users, role, created_at, unique(team_id, user_id))
MatchRegistrations(id PK, match_id FK Matches, team_id FK Teams, status, note, created_at, updated_at,
                   unique(match_id, team_id))
```

### Основные REST эндпоинты
`/api/health`
`/api/cities` GET/POST, `/api/cities/:id` GET/PUT/DELETE
`/api/stadiums` GET (filter cityId), POST
`/api/stadiums/:id` GET/PUT/DELETE
`/api/matches` GET (filters: cityId via stadium relation, stadiumId, status), POST
`/api/matches/:id` GET/PUT/DELETE
`/api/teams` GET (cityId), POST; `/api/teams/:id` GET/PUT/DELETE
`/api/users` GET (role, cityId), POST, PUT, DELETE
`/api/registrations` GET (matchId, status), POST
`/api/registrations/:id/status` PATCH (approve/reject)

> Авторизация: для прототипа предполагается отдельный middleware (например, JWT в `Authorization: Bearer`), не включён в базовый каркас.

## Админ-панель (React)
- Vite + React + TypeScript.
- React Router для разделов, React Query + Axios для данных, Leaflet для карты выбора координат.
- UI слои: простая кастомная тема (зелёно-графитовая), латиница без системных шрифтов: "Manrope", fallback sans.

### Структура
```
admin/
  src/
    api/client.ts           # axios клиент
    api/hooks.ts            # React Query хуки
    components/Layout.tsx   # shell с боковой навигацией
    components/MapPicker.tsx
    pages/CitiesPage.tsx
    pages/StadiumsPage.tsx
    pages/MatchesPage.tsx
    pages/TeamsPage.tsx
    pages/RegistrationsPage.tsx
    main.tsx, App.tsx
  src/styles/theme.css
```

### Потоки
- Города: список + модалка создания/редактирования (name).
- Стадионы: список с фильтром по городу, форма с картой (MapPicker: клик ставит маркер, записывает lat/long).
- Матчи: выбор города → фильтр стадионов, форма с датой/временем, формат 5x5/7x7/11x11, статус.
- Заявки: таблица, действия Approve/Reject.

### Карта
- Leaflet + OSM, центр по выбранному городу (можно задавать дефолт широту/долготу), клик по карте → `onChange({lat, lng})`.

## Масштабируемость
- Города — первичный сегмент: все сущности имеют cityId для шардирования и фильтрации.
- Prisma и PostgreSQL позволяют вынести чтение/запись на read-replicas, добавить новые типы событий: расширение enum или новая таблица Event с типом.
- Отделение API и фронта облегчает деплой (Docker образы).

## Быстрый старт (dev)
1) Скопировать `.env.example` в `.env` и выставить `DATABASE_URL`.
2) `cd backend && npx prisma migrate dev && npm run dev`
3) `cd admin && npm install && npm run dev`

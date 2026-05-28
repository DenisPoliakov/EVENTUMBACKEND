# EVENTUM Admin And Server

Эта часть проекта отвечает за админку и единый backend `EVENTUM`.

Структура:
- `PLAYGOADMIN/admin` — веб-админка на React/Vite
- `PLAYGOADMIN/backend` — API на Node.js/Express/Prisma
- `PLAYGO/frontend` — мобильное приложение, которое работает с тем же backend

## Как это работает

Backend `EVENTUM` хранит и отдает все основные данные проекта:
- пользователи
- города
- стадионы
- матчи
- команды
- заявки на матчи
- карточки футболистов
- изображения

Админка работает через Basic Auth и управляет данными напрямую через `/api/admin/...`.

Мобильное приложение использует те же данные, но ходит в публичные и авторизованные app-эндпоинты:
- `/api/auth/...`
- `/api/me/...`
- `/api/stadiums`
- `/api/matches`
- `/api/registrations`
- `/api/players`
- `/api/teams/...`

За счет этого админка и приложение всегда смотрят в один источник данных.

## Стек

- React + Vite
- Node.js + Express
- Prisma
- PostgreSQL

## Запуск

### PostgreSQL

```bash
brew services start postgresql@16
createuser -P playgoadmin
createdb -O playgoadmin playgoadmin
```

### Backend

```bash
cd PLAYGOADMIN/backend
npm install
cp .env.example .env
```

Пример `.env`:

```env
DATABASE_URL="postgresql://playgoadmin:playgoadmin@localhost:5432/playgoadmin?schema=public"
PORT=4000
ADMIN_USER=admin
ADMIN_PASSWORD=admin
JWT_SECRET=dev-secret-change-me
WEBHOOK_URL=
```

Запуск backend:

```bash
cd PLAYGOADMIN/backend
npx prisma generate
npx prisma db push
npm run dev
```

Backend поднимается на `http://localhost:4000`.

### Админка

```bash
cd PLAYGOADMIN/admin
npm install
npm run dev
```

Админка обычно открывается на `http://localhost:5173`.

## Что умеет админка

- управлять городами
- управлять стадионами
- создавать и редактировать матчи
- просматривать и модерировать заявки
- просматривать пользователей
- менять ник пользователя
- блокировать пользователя на платформе
- ограничивать подачу заявок на матч
- работать с командами и составами

## Логика карточек футболиста

Карточка футболиста создается самим пользователем в мобильном приложении и хранится в общей базе данных.

Карточка содержит:
- позицию
- ведущую ногу
- физические параметры
- любимый формат матча
- био
- аватар
- рейтинг
- до 3 сильных сторон
- до 3 статусов игрока

Сильные стороны и статусы выбираются только из заранее определенных значений.

Карточка используется в двух местах:
- для вкладки `Игроки`
- как обязательное условие для подачи заявки на матч

## Логика команд

Команда создается пользователем в мобильном приложении.

Основные правила:
- один пользователь может иметь только одну текущую команду
- создатель команды автоматически становится капитаном
- капитан может приглашать игроков по логину или email
- приглашение приходит игроку как уведомление
- игрок может принять или отклонить приглашение
- капитан управляет ролями участников и их игровой позицией

Роли участника:
- `CAPTAIN`
- `MEMBER`
- `SUBSTITUTE`

Игровые позиции в составе:
- `GK`
- `DF`
- `MF`
- `FW`

## Логика заявок и автопринятия

Заявка всегда относится к команде, а не к случайно введенным данным вручную.

Перед созданием заявки backend проверяет:
- есть ли у пользователя карточка футболиста
- не заблокирован ли пользователь на платформе
- нет ли у пользователя активного запрета на подачу заявок
- состоит ли пользователь в команде
- открыт ли матч для заявок
- нет ли у команды уже активной заявки на этот матч
- нет ли у капитана другой активной заявки на этот матч

После создания заявка появляется в админке и может быть обработана вручную.

Режимы модерации заявок:
- `MANUAL`
- `AUTO_FIRST_COME`

`MANUAL`:
- заявка приходит в статусе `PENDING`
- администратор решает, принимать ее или нет

`AUTO_FIRST_COME`:
- если количество `APPROVED` команд меньше `maxTeams`, заявка сразу получает `APPROVED`
- если мест уже нет, заявка остается `PENDING`
- если одобренную команду потом снимают, backend автоматически поднимает первую подходящую `PENDING` заявку

## API

Полный список эндпоинтов лежит в отдельном файле:

`API_README.md` (в корне репозитория)

## Как добавить новую API-ручку

Ниже — типовой порядок доработки backend, когда нужно расширить API (новый ресурс, действие пользователя или админская операция).

### 1. Определить тип эндпоинта

| Тип | Префикс | Авторизация | Где подключать |
|-----|---------|-------------|----------------|
| Публичный / приложение | `/api/...` | без токена или `Bearer` | `src/routes/public.js`, `auth.js`, `teamHub.js`, `ecosystem.js` или отдельный роутер через `router.use(...)` |
| Личные данные пользователя | `/api/me/...` | `requireAuth` | тот же роутер, что и другие `me`-ручки |
| Админка | `/api/admin/...` | Basic Auth (middleware в `src/index.js`) | отдельный файл в `src/routes/` + `app.use('/api/admin/...', router)` |

Примеры уже существующих модулей:
- `src/routes/playerCards.js` — карточки игроков (`/api/players`, `/api/me/player-card`)
- `src/routes/coachProfiles.js` — профиль тренера (`/api/me/coach-profile`)
- `src/routes/users.js` — админские пользователи (`/api/admin/users`)

### 2. Модель данных (если нужна новая сущность)

1. Добавить модель в `prisma/schema.prisma`.
2. Применить схему локально:

```bash
cd PLAYGOADMIN/backend
npx prisma generate
npx prisma db push
```

Сложную бизнес-логику (каскады, удаление связей) выносить в `src/lib/`, а не дублировать в роутерах. Пример: `src/lib/userDeletion.js` для `DELETE /api/me`.

### 3. Создать или расширить роутер

Файл в `src/routes/<resource>.js`:

```js
import express from 'express'
import prisma from '../prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

router.get('/me/example', requireAuth, async (req, res, next) => {
  try {
    // req.auth.sub — id текущего пользователя из JWT
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
```

Правила, которых придерживаемся в проекте:
- валидация входа → `400` с `{ error: '...' }`
- нет токена / неверный токен → `401`
- нет прав или блокировка → `403` (при необходимости с `message`)
- сущность не найдена → `404`
- успешное создание → `201`, удаление без тела → `204`
- необработанные ошибки передавать в `next(err)` — их ловит общий handler в `src/index.js`

Для загрузки файлов — `multer`, файлы кладём в `public/uploads/...`, в ответ отдаём относительный URL вида `/uploads/...`.

### 4. Подключить роутер

**App / public** — в `src/routes/public.js` или `src/index.js`:

```js
import exampleRouter from './routes/example.js'
router.use('/', exampleRouter)   // public.js
// или
app.use('/api', exampleRouter)   // index.js
```

**Admin** — в `src/index.js` после Basic Auth middleware:

```js
import exampleRouter from './routes/example.js'
app.use('/api/admin/examples', exampleRouter)
```

После изменений перезапустить backend (`npm run dev`).

### 5. Проверить вручную

```bash
# публичная ручка
curl http://localhost:4000/api/health

# с JWT
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/me

# админка
curl -u admin:admin http://localhost:4000/api/admin/users
```

### 6. Обновить документацию

Обязательно дописать новую ручку в **`API_README.md`** (корень репозитория):
- метод и путь;
- нужна ли авторизация;
- поля `body` / query;
- пример ответа и типичные ошибки.

При наличии OpenAPI-спеки — синхронизировать `PLAYGOADMIN/backend/openapi.yaml`.

### 7. Клиенты (по необходимости)

- мобильное приложение: `PLAYGO/frontend/lib/services/api_client.dart` или `admin_api.dart`;
- веб-админка: `PLAYGOADMIN/admin/src/api/hooks.ts` и типы в `types.ts`.

Базовый URL клиентов по умолчанию: `http://localhost:4000`.

## Что важно помнить

- название продукта: `EVENTUM`
- backend один для всего проекта
- Docker не нужен
- база данных одна: PostgreSQL

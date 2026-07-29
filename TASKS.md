# Задачи для backend-разработчика (после доработок мобильного клиента)

**Проект:** Eventum Clubs (iOS / Android)  
**Дата:** 28.07.2026  
**Контекст:** клиент уже содержит вкладку «Wellness» (истории + тренировки), коммерцию, клубы, новости. Часть контента **зашита в приложение** (каталоги + l10n). Для корректной работы в production контент и часть бизнес-логики должны приходить с сервера и редактироваться через **админ-панель**.

**Production API (ориентир):** `http://77.95.206.96`  
**Админка:** `/api/admin/*` (Basic Auth) — отдельное web-приложение, см. [EVENTUM_IMPLEMENTATION_PHASES.md](EVENTUM_IMPLEMENTATION_PHASES.md).

---

## Резюме: что сейчас на клиенте

| Область | Источник данных в приложении | Нужен backend |
|---------|------------------------------|---------------|
| **Истории (wellness stories)** | `WellnessTipsCatalog` — 10 статических записей; текст в l10n | **Да, полностью** |
| **Программы тренировок** | `WorkoutProgramsCatalog` — 5 программ; тексты в l10n | **Да, полностью** |
| **Шаги тренировки (таймер)** | Парсятся из l10n-гайда в `WorkoutSessionBuilder` | **Да — структурированные steps** |
| **История тренировок** | `SharedPreferences` (`workout_completion_history_v2`) | **Да — синхронизация** |
| **Новости** | `GET /api/me/news` | Работает; нужен CMS в админке |
| **Клубы** | `GET /api/clubs`, `GET /api/clubs/:id` | Работает; доработки ниже |
| **Коммерция** | API + **локальный fallback** при 404/501 | Довести API, убрать fallback |
| **Premium / рефералы** | Только локально в prefs | **Да** |
| **Аналитика просмотров** | Нет | **Да** — истории, тренировки, новости |

---

## Аналитика просмотров (сводка)

Единая задача для backend: **фиксировать просмотры контента** и отдавать счётчики в админку.

| Контент | Метрика | Уникальность | Endpoint фиксации | Поля в ответе ленты |
|---------|---------|--------------|-------------------|---------------------|
| **Wellness-история** | уник. пользователи | 1 user = 1 раз | `POST /api/me/wellness-stories/:id/view` | `uniqueViewerCount`, `viewedByMe` |
| **Программа тренировки** | уник. пользователи | 1 user = 1 раз | `POST /api/me/workout-programs/:id/view` | `uniqueViewerCount`, `viewedByMe` |
| **Новость** | просмотры + уник. users | total + unique | `POST /api/me/news/:id/view` | `viewCount`, `uniqueViewerCount` |

**Общие требования:**

1. Все `POST .../view` — только для авторизованных (`Bearer`); без авторизации просмотр не считается (или отдельное решение для guest — по согласованию).
2. Идемпотентность для историй и тренировок: повторный POST тем же пользователем **не** увеличивает `uniqueViewerCount`.
3. Для новостей: повторный POST **увеличивает** `viewCount`, но не `uniqueViewerCount`.
4. При удалении пользователя — каскадное удаление записей `*View` (GDPR).
5. Админка показывает актуальные счётчики без отдельного отчёта (колонки в списках).

**Prisma (ориентир для миграции):**

```
WellnessStoryView   @@unique([storyId, userId])
WorkoutProgramView  @@unique([programId, userId])
NewsView            — без unique (или отдельная таблица + денормализация счётчиков на News)
News.viewCount, News.uniqueViewerCount — денормализованные поля для быстрого чтения в админке
```

---

## Приоритет 1 — Истории (Wellness Stories)

### Текущее поведение клиента

- Файлы: `lib/features/main/data/wellness_tips_catalog.dart`, `wellness_home_pane.dart`, `wellness_story_viewer.dart`
- Модель: `id`, `WellnessCategory` (enum), `IconData`, `readMinutes`
- Заголовок и текст: `l10n.wellnessTipTitle(id)` / `wellnessTipBody(id)` — **не из API**
- Горизонтальная лента на главной вкладке Wellness; полноэкранный просмотр с листанием

### Задачи backend

#### 1.1. Модель данных «история»

Поля, которые клиенту нужно отдавать (минимум):

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string / number | Стабильный id |
| `title` | string | Заголовок |
| `body` | string | Текст (markdown или plain text) |
| `category` | string | `nutrition` \| `warmup` \| `routine` \| `workouts` \| `balance` |
| `coverImageUrl` | string? | Обложка в ленте (вместо иконки Material) |
| `readMinutes` | number | Время чтения |
| `sortOrder` | number | Порядок в ленте |
| `locale` | string? | `ru`, `en` — если мультиязычность на сервере |
| `publishedAt` | ISO datetime | Дата публикации |
| `isActive` | boolean | Показывать в приложении |

#### 1.2. Public / user API

```
GET /api/wellness-stories?locale=ru&limit=50
```

Ответ:

```json
{
  "stories": [ { "id": "...", "title": "...", "body": "...", "category": "nutrition", ... } ]
}
```

Опционально (для «кольца» просмотра, как в Instagram):

```
GET  /api/me/wellness-stories/views
POST /api/me/wellness-stories/:id/view
```

#### 1.5. Аналитика просмотров историй

**Требование:** считать **количество уникальных пользователей**, просмотревших историю.

| Задача | Описание |
|--------|----------|
| Модель `WellnessStoryView` | `storyId`, `userId`, `viewedAt`; уникальность `(storyId, userId)` — один пользователь = один в счётчике |
| Счётчик на истории | Поле `uniqueViewerCount` (денормализованное) или `_count` views |
| API фиксации | `POST /api/me/wellness-stories/:id/view` — Bearer, идемпотентно (повторный POST не увеличивает счётчик) |
| Ответ API | `{ storyId, uniqueViewerCount, isFirstViewByUser }` |
| Лента для клиента | В `GET /api/wellness-stories` — поле `viewedByMe: boolean` для авторизованного пользователя |
| Админка | В списке историй колонка **«Просмотрели (уник.)»** — `uniqueViewerCount` |

**Когда вызывает клиент:** открытие истории в `WellnessStoryViewer` (полноэкранный просмотр).

#### 1.6. Админ-панель — CRUD историй

| Задача | Описание |
|--------|----------|
| Список историй | Таблица: заголовок, категория, статус, порядок, дата, **уник. просмотры** |
| Создание / редактирование | title, body (редактор), category, readMinutes, sortOrder, locale |
| Загрузка обложки | `POST /api/admin/wellness-stories/:id/cover` → URL в `/uploads/...` |
| Публикация / снятие | `isActive`, `publishedAt` |
| Удаление | soft delete предпочтительнее |

#### 1.7. Согласование с клиентом

После готовности API мобильный клиент:

- заменит `WellnessTipsCatalog` на провайдер с fetch;
- уберёт тексты из l10n для историй;
- будет использовать `coverImageUrl` вместо `IconData`.

---

## Приоритет 2 — Программы тренировок

### Текущее поведение клиента

- Каталог: `lib/features/main/data/workout_programs_catalog.dart` — id: `street`, `home_abs`, `home_legs`, `home_upper`, `home_full`
- Названия, описания, гайды: **l10n** (`workoutProgramTitle`, `workoutProgramGuide`, …)
- Шаги сессии: `WorkoutSessionBuilder` **парсит текст гайда** и сам выставляет фазы (warmup/work/rest) и длительности (дефолт 90 с работа, 45 с отдых)
- Иллюстрации упражнений: placeholder (`exercise_step_illustration.dart`), без CDN

### Задачи backend

#### 2.1. Модель «программа тренировок»

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | slug, напр. `street` |
| `title` | string | |
| `subtitle` | string? | |
| `description` | string | Краткое описание на карточке |
| `guide` | string? | Полный текст (legacy; клиент может перестать парсить) |
| `iconKey` | string? | Ключ иконки или URL |
| `gradientStart` / `gradientEnd` | string? | HEX цвета карточки |
| `estimatedMinutes` | number? | |
| `sortOrder` | number | |
| `isActive` | boolean | |
| `locale` | string? | |

#### 2.2. Модель «шаг тренировки» (обязательно структурированно)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | |
| `programId` | string | FK |
| `order` | number | Порядок в сессии |
| `phase` | string | `warmup` \| `work` \| `rest` \| `cooldown` |
| `title` | string | |
| `description` | string? | |
| `durationSeconds` | number | Длительность таймера |
| `illustrationUrl` | string? | Картинка/анимация упражнения |
| `poseIndex` | number? | Индекс позы (0–5), если без картинки |

#### 2.3. API

```
GET /api/workout-programs?locale=ru
GET /api/workout-programs/:id
GET /api/workout-programs/:id/steps
```

Ответ списка:

```json
{
  "programs": [
    {
      "id": "street",
      "title": "Уличная тренировка",
      "subtitle": "...",
      "description": "...",
      "gradientStart": "#E8F5EC",
      "gradientEnd": "#86EFAC",
      "estimatedMinutes": 25,
      "sortOrder": 1
    }
  ]
}
```

Ответ шагов:

```json
{
  "steps": [
    {
      "id": "s1",
      "order": 1,
      "phase": "warmup",
      "title": "Разминка",
      "description": "...",
      "durationSeconds": 120,
      "illustrationUrl": "/uploads/workouts/street/warmup.png"
    }
  ]
}
```

#### 2.4. Админ-панель — тренировки

| Задача | Описание |
|--------|----------|
| CRUD программ | Все поля из п. 2.1 |
| Редактор шагов | Drag-and-drop порядок; фаза, длительность, текст |
| Загрузка иллюстраций | multipart → `/uploads/workouts/...` |
| Предпросмотр | Суммарная длительность сессии |
| Локализация | ru/en версии или одна локаль на запись |

**Важно:** клиент должен получать **готовые steps**, а не сырой текст для парсинга.

#### 2.5. Аналитика просмотров тренировок

**Требование:** считать **количество уникальных пользователей**, открывших программу тренировки.

| Задача | Описание |
|--------|----------|
| Модель `WorkoutProgramView` | `programId`, `userId`, `viewedAt`; уникальность `(programId, userId)` |
| Счётчик на программе | Поле `uniqueViewerCount` |
| API фиксации | `POST /api/me/workout-programs/:id/view` — Bearer, идемпотентно |
| Ответ API | `{ programId, uniqueViewerCount, isFirstViewByUser }` |
| Лента для клиента | В `GET /api/workout-programs` — поле `viewedByMe: boolean` |
| Админка | Колонка **«Просмотрели (уник.)»** в списке программ |

**Когда вызывает клиент:** открытие `WorkoutProgramScreen` (экран программы перед стартом таймера).

---

## Приоритет 3 — История тренировок пользователя

### Текущее поведение

- `lib/features/main/providers/workout_history_provider.dart`
- Хранение локально: `workout_completion_history_v2`
- Поля записи: `programId`, `finishedAt`, `durationSeconds`, custom plan details

### Задачи backend

#### 3.1. API синхронизации

```
GET  /api/me/workout-sessions?from=&to=&limit=
POST /api/me/workout-sessions
```

Тело POST:

```json
{
  "programId": "street",
  "startedAt": "2026-07-28T10:00:00Z",
  "finishedAt": "2026-07-28T10:25:00Z",
  "durationSeconds": 1500,
  "source": "timer",
  "customPlan": null
}
```

Для ручного лога (`workout_log_entry_screen`):

```json
{
  "programId": "home_abs",
  "finishedAt": "...",
  "durationSeconds": 1800,
  "source": "manual"
}
```

#### 3.2. Миграция

- При первом входе: клиент отправит локальную историю пачкой (`POST /api/me/workout-sessions/bulk`) — **желательно реализовать**.
- Конфликты: server wins или merge по `finishedAt` + `programId`.

#### 3.3. Админка (backend/admin выполнено; mobile без изменений)

- ✅ Ограниченная агрегированная статистика (сессии, уникальные пользователи, длительность, популярные программы, диапазон до 366 дней) доступна в API и admin-разделе.

---

## Приоритет 4 — Новости (CMS в админке)

### Текущее поведение

- `GET /api/me/news?limit=40&favoritesOnly=&clubId=`
- Клиент парсит: `id`, `title`, `body`, `imageUrl`, `type`, `clubId`, `publishedAt`, вложенный `club`
- Параметр `clubId` в API-клиенте есть, в UI клуба **не подключён**

### Задачи backend

| # | Задача |
|---|--------|
| 4.1 | **Админка:** CRUD новостей — заголовок, текст, картинка, тип (`news` / `sponsored`), привязка к `clubId`, дата публикации |
| 4.2 | **Админка:** загрузка `imageUrl` через `/api/admin/news/:id/image` |
| 4.3 | Фильтр `favoritesOnly=true` — только новости клубов из избранного пользователя (проверить/реализовать) |
| 4.4 | Поле `type: sponsored` для рекламных интеграций (клиент показывает badge) |
| 4.5 | ✅ `GET /api/news` — production-compatible guest feed с единым DTO, counters, sponsored и club; подключение mobile отдельно |

#### 4.6. Аналитика просмотров новостей

**Требование:** отслеживать **количество просмотров** поста и **уникальных пользователей**.

| Задача | Описание |
|--------|----------|
| Модель `NewsView` | `newsId`, `userId`, `viewedAt` — каждый POST создаёт запись (total views растёт при повторных просмотрах) |
| Счётчики на `News` | `viewCount` — всего; `uniqueViewerCount` — уникальных пользователей |
| API фиксации | `POST /api/me/news/:id/view` — Bearer |
| Ответ API | `{ newsId, viewCount, uniqueViewerCount, isFirstViewByUser }` |
| Лента `GET /api/me/news` | В объект новости добавить `viewCount`, `uniqueViewerCount` |
| Админка (`NewsPage`) | Колонки **«Просмотры»** и **«Уник. пользователи»** |

**Когда вызывает клиент:** tap по карточке новости в `NewsFeedPane`.

**Логика:**

- `viewCount` +1 при каждом `POST /view`
- `uniqueViewerCount` +1 только если пользователь впервые просмотрел эту новость

---

## Приоритет 5 — Клубы и расписание

### Уже работает

```
GET /api/clubs
GET /api/clubs/:id
GET /api/me/favorite-clubs
POST/DELETE /api/me/favorite-clubs
```

Клиент парсит: `imageUrls`, `logoUrl`, `coaches[]` (нужен `id` для перехода в `/coach/:id`), `schedules[]`, `subscriptions`/`passes`, `tier`.

### Задачи backend

| # | Задача | Зачем |
|---|--------|-------|
| 5.1 | **Цена слота расписания** в `schedules[]`: поле `priceCents` | Сейчас в `club_schedule_screen.dart` захардкожено **50 000** коп. (500 ₽) |
| 5.2 | **ID слота** (`scheduleId` / `entryId`) для бронирования | Привязка booking к конкретному занятию |
| 5.3 | `coaches[].id` обязателен для кликабельных имён | Иначе тренер не открывается |
| 5.4 | **Tier клуба** (`BRONZE` / `SILVER` / `GOLD`) в ответе клуба | Бейдж `ClubTierBadge` |
| 5.5 | **Админка:** управление галереей клуба, расписанием, тарифами, tier | Контент карточки клуба |
| 5.6 | Единый формат медиа-URL (`/uploads/...` или absolute) | `api_media_url` на клиенте |

### Бронирование занятия из расписания

Клиент вызывает:

```
POST /api/me/bookings
{
  "coachId": "",
  "scheduledAt": "...",
  "priceCents": 50000,
  "clubId": "...",
  "scheduleTitle": "...",
  "note": "..."
}
```

**Нужно:**

- принимать `scheduleEntryId` или `scheduleId`;
- брать `priceCents` с сервера, **не доверять клиенту**;
- возвращать созданное бронирование в формате, который парсит `TrainingBooking.fromJson`.

---

## Приоритет 6 — Коммерция и монетизация

### Уже есть в API-клиенте

```
POST /api/me/orders          — абонемент / free trial
GET  /api/me/subscriptions
GET  /api/me/bookings
POST /api/me/bookings
GET  /api/admin/subscriptions
PATCH /api/admin/subscriptions/:id/status
```

### Проблема

`CommerceRepository` при **404 / 501 / 405** пишет заказы и брони в **локальный SharedPreferences** — данные «фиктивные», не синхронизируются.

### Задачи backend

| # | Задача |
|---|--------|
| 6.1 | Стабильно реализовать `POST /api/me/orders` с телом `{ clubId, type, passId?, priceCents }` и ответом `{ orderId, subscription?, message }` |
| 6.2 | `GET /api/me/subscriptions` — список с полями: `id`, `status`, `clubId`, `clubName`, `title`, `priceCents`, `durationDays`, `expiresAt` |
| 6.3 | **Админка:** тарифы клубов (Bronze/Silver/Gold 3000/5000/7000 ₽) — связь с `passes` в карточке клуба |
| 6.4 | **Платёжный провайдер** (ЮKassa / CloudPayments): payment intent → webhook → активация subscription |
| 6.5 | `POST /api/me/bookings` — валидация цены, комиссия 15% (`platformFeeCents` в ответе) |
| 6.6 | **Premium подписка приложения** (~299 ₽/мес): `GET/POST /api/me/premium` — сейчас только локальный toggle |
| 6.7 | **Реферальная программа**: `GET /api/me/referral`, `POST /api/me/referral/apply` — код и счётчик сейчас генерируются на клиенте |

---

## Приоритет 7 — Уведомления

### Клиент

```
GET  /api/me/notifications
POST /api/me/notifications/:id/read
POST /api/me/notifications/read-all
```

### Задачи backend

| # | Задача |
|---|--------|
| 7.1 | Push-триггеры: новость клуба из избранного, подтверждение брони, истечение абонемента |
| 7.2 | ✅ **Backend/admin:** durable ручная рассылка, preview, шаблоны, сегменты, idempotent send и реальные FCM counters; Firebase/mobile provisioning отдельно |
| 7.3 | FCM/APNs токены: `POST /api/me/push-tokens` — если ещё нет |

---

## Приоритет 8 — Прочее (по коду клиента)

| # | Область | Задача |
|---|---------|--------|
| 8.1 | `GET /api/ecosystem` | Агрегат для главной (избранное, счётчики) — клиент вызывает, wellness не использует |
| 8.2 | `GET /api/sports` | Справочник видов спорта — используется; поддерживать актуальность в админке |
| 8.3 | Coach profiles | `GET /api/coach-profiles/search`, публичный профиль — для экрана тренера |
| 8.4 | Чаты | WebSocket `/api/ws/chats`, REST `/api/me/chats/*` — уже в клиенте |
| 8.5 | AI-подбор клубов | ✅ Backend хранит caller-supplied history через Bearer GET/POST/DELETE `/api/me/ai-matches`; AI не генерирует, mobile integration не выполнена |
| 8.6 | Support bot | ✅ Backend тикеты + admin queue/status/reply/notes; локальный FAQ/mobile integration не изменены |
| 8.7 | Auth refresh | `POST /api/auth/refresh` — клиент ожидает при 401 |

---

## Сводная таблица: админ-панель (минимум для production)

| Раздел админки | CRUD | Медиа | Связи |
|----------------|:----:|:-----:|-------|
| **Wellness-истории** | ✓ | обложка | category, locale, sortOrder |
| **Программы тренировок** | ✓ | — | steps |
| **Шаги тренировок** | ✓ | иллюстрация | programId, phase, duration |
| **Новости** | ✓ | image | clubId, type, sponsored |
| **Клубы** | ✓ | logo, gallery | coaches, schedules, passes, tier |
| **Расписание клуба** | ✓ | — | priceCents, coachProfileId |
| **Абонементы пользователей** | read + status | — | уже есть `/api/admin/subscriptions` |
| **Тарифы клубов (B/S/G)** | ✓ | — | clubId |
| **Push / уведомления** | ✅ backend/admin | — | all users, selected users, favorite club; FCM provisioning/mobile отдельно |
| **Аналитика просмотров** | read | — | счётчики в списках историй / тренировок / новостей |

---

## Рекомендуемый порядок реализации

1. **Wellness stories** — API + админка + **аналитика просмотров**
2. **Workout programs + steps** — API + админка + **аналитика просмотров**
3. **News view tracking** — `POST /api/me/news/:id/view` + счётчики в админке
4. **Workout sessions sync** — POST/GET для истории тренировок
5. **Расписание: priceCents + scheduleId** — убрать хардкод 500 ₽ на клиенте
6. **Commerce без fallback** — orders, subscriptions, bookings, webhooks оплаты
7. Premium, referral, push — по roadmap монетизации

---

## Контракты для согласования с mobile-командой

Перед разработкой согласовать с фронтом:

1. JSON-схемы ответов для `wellness-stories`, `workout-programs`, `workout-sessions`
2. Формат `category` и `phase` (enum strings как в таблицах выше)
3. Формат URL медиа (`/uploads/...` vs absolute)
4. Коды ошибок для commerce (чтобы **отключить local fallback**)
5. Версионирование API (`Accept-Version` или `/api/v1/...`)

---

*Документ составлен по состоянию репозитория `eventum_clubs` · wellness/workout — static catalogs · commerce — partial API*

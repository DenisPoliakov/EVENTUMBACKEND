# EVENTUM API

Этот файл описывает API backend проекта `EVENTUM`.

Базовый адрес локально:

```text
http://localhost:4000
```

Форматы авторизации:
- приложение: `Authorization: Bearer <token>`
- админка: `Authorization: Basic <base64(user:password)>`

## Что добавлено в этом обновлении

- добавлены русскоязычные Wellness-истории:
  - `GET /api/wellness-stories`
  - `POST /api/me/wellness-stories/:id/view`
  - CRUD и загрузка обложки в `/api/admin/wellness-stories`
  - уникальные просмотры и `viewedByMe`
- добавлены русскоязычные программы тренировок:
  - публичный каталог, карточка и структурированные шаги
  - Bearer-фиксация уникальных просмотров
  - CRUD программ и шагов, точная перестановка и загрузка иллюстраций в админке
- добавлена server-wins синхронизация истории тренировок через `/api/me/workout-sessions`
- новости поддерживают тип `sponsored`, безопасную загрузку изображений и точные total/unique просмотры
- добавлены direct-чаты между пользователями
- добавлен чат пользователя с тренером через `coachProfileId`
- добавлены ручки:
  - `GET /api/me/chats`
  - `POST /api/me/chats/direct`
  - `POST /api/me/chats/coach-profile/:coachProfileId`
  - `GET /api/me/chats/:chatId`
  - `GET /api/me/chats/:chatId/messages`
  - `POST /api/me/chats/:chatId/messages`
  - `POST /api/me/chats/:chatId/read`
- добавлен поиск пользователей по username и друзья (чтобы чаты не терялись):
  - `GET /api/users/search`
  - `GET /api/me/friends`
  - `GET /api/me/friends/requests`
  - `GET /api/me/friends/outgoing`
  - `POST /api/me/friends`
  - `POST /api/me/friends/:friendshipId/accept`
  - `POST /api/me/friends/:friendshipId/reject`
  - `DELETE /api/me/friends/:userId`
- `GET /api/clubs` поддерживает поиск по названию через `q` / `name`
- исправлена серверная логика смены никнейма через `PATCH /api/me`
- в профиль пользователя добавлен `phone`
- добавлено избранное клубов:
  - `GET /api/me/favorite-clubs`
  - `POST /api/me/favorite-clubs`
  - `DELETE /api/me/favorite-clubs/:clubId`
- добавлена персональная лента новостей:
  - `GET /api/me/news`
- добавлены пользовательские уведомления по новостям любимых клубов:
  - `GET /api/me/notifications`
  - `PATCH /api/me/notifications/:id/read`
  - `POST /api/me/notifications/read-all`
- клубные новости теперь можно привязывать к `clubId`
- тренерский профиль упрощен:
  - обязательный номер телефона
  - описание тренера
  - привязка к клубу стала опциональной
- публичный поиск карточек тренеров по городу клуба: `GET /api/coach-profiles/search`
- пользовательский список абонементов закреплен за `GET /api/me/subscriptions`
- клубы отдают `tier`, нормализованные `logoUrl` / `imageUrls`, активные
  `passes` и расписание с серверной ценой и `coachProfileId`
- добавлены бронирования тренировок:
  - `GET /api/me/bookings`
  - `POST /api/me/bookings`
  - `GET /api/admin/bookings`
  - `PATCH /api/admin/bookings/:id/status`
- добавлено удаление собственного аккаунта через `DELETE /api/me`
- добавлены безопасные заказы и платежи YooKassa:
  - `POST /api/me/orders`
  - `POST /api/webhooks/yookassa`
  - `GET /api/admin/orders`
- добавлены Premium через тот же проверяемый YooKassa pipeline, реферальные коды
  с Premium-кредитами и ротационные opaque refresh-токены
- админское удаление пользователя теперь чистит связанные сущности пользователя корректно

## Быстрые правила

- локальный backend по умолчанию работает на `http://localhost:4000`
- все app-эндпоинты начинаются с `/api/...`
- все admin-эндпоинты начинаются с `/api/admin/...`
- для профиля, команды и карточки игрока используется логика `my resource`
- если ручка требует токен, без `Bearer` вернется `401`
- профиль не должен использовать `/api/admin/subscriptions`
- для экрана абонементов в приложении используется `GET /api/me/subscriptions`
- для direct-чатов используется `/api/me/chats/...`
- для избранного клубов используется `/api/me/favorite-clubs`
- для персональной новостной ленты используется `/api/me/news`
- для пользовательских уведомлений используется `/api/me/notifications`
- аккаунт пользователя общий для всей экосистемы
- спортивные сущности разделяются по `sportId` / `sportCode`
- футбол, бокс и будущие виды спорта живут в общей PostgreSQL-базе, но логически изолированы видом спорта

## Как добавить новую ручку (для разработчиков)

Пошаговый чеклист по доработке backend (Prisma → роутер → подключение → документация → клиенты) описан в **`PLAYGOADMIN/README.md`**, раздел «Как добавить новую API-ручку».

Кратко:
1. выбрать тип: `/api/...` (app) или `/api/admin/...` (админка);
2. при необходимости обновить `prisma/schema.prisma` и выполнить `npx prisma db push`;
3. добавить обработчик в `PLAYGOADMIN/backend/src/routes/` и подключить его в `index.js` или `public.js`;
4. задокументировать метод здесь, в `API_README.md`;
5. при необходимости обновить Flutter (`api_client.dart` / `admin_api.dart`) и React-админку.

## Public And App API

### Auth refresh

- `POST /api/auth/login` и `POST /api/auth/register` сохраняют прежние
  `accessToken` / `user` и дополнительно возвращают `refreshToken` / `expiresIn`.
- `POST /api/auth/refresh` принимает `{ "refreshToken": "..." }`, одноразово
  ротирует opaque-токен и возвращает новый комплект. Повтор старого токена,
  истёкший токен, а также токен заблокированного или удалённого пользователя
  отклоняются с `401`.
- `POST /api/auth/logout` отзывает переданный refresh-токен и возвращает `204`.
- TTL задаются `ACCESS_TOKEN_TTL_SECONDS` и `REFRESH_TOKEN_TTL_SECONDS`;
  в базе хранится только SHA-256 hash refresh-токена.

### Premium and referrals

- `GET /api/me/premium` (Bearer) возвращает `active`, `expiresAt`, серверную
  цену, валюту, длительность тарифа и состояние `premiumCredits`.
- `POST /api/me/premium` (Bearer + `Idempotency-Key`) создаёт Premium-заказ
  в существующем `Order` / `Payment` / YooKassa pipeline и возвращает
  `confirmationUrl`. По умолчанию цена — 299 RUB, срок — 30 дней.
- Только проверенный `POST /api/webhooks/yookassa` активирует Premium.
  Повтор webhook не продлевает срок повторно; новая оплаченная покупка
  добавляет срок к текущей активной подписке.
- `GET /api/me/referral` возвращает уникальный код, число приглашённых и
  применённый пользователем код, если он есть, баланс Premium-кредитов и
  текущие условия реферальной программы.
- `POST /api/me/referral/apply` принимает `code` или `referralCode`
  без учёта регистра, проверяет владельца, запрещает собственный код,
  повторное и слишком позднее применение.
- `POST /api/auth/register` также принимает необязательный `referralCode`
  или `inviteCode`; неверный код отменяет регистрацию целиком.
- По умолчанию владелец кода получает `10000` копеек (100 RUB) внутренних
  Premium-кредитов, а приглашённый — 7 бесплатных дней Premium. Настройки:
  `REFERRAL_REWARD_CENTS`, `REFERRED_BONUS_PREMIUM_DAYS`,
  `REFERRAL_APPLY_WINDOW_HOURS`.
- Начисление кода, кредитов, журнала операции и бонусной подписки выполняется
  в одной транзакции. Одно приглашение нельзя начислить дважды.
- `GET /api/me/premium/credits` возвращает баланс и журнал начислений/списаний.
- `POST /api/me/premium/credits/purchase` (Bearer + `Idempotency-Key`)
  покупает Premium полностью за внутренние кредиты. Цена берётся только с
  сервера; частичная доплата, вывод и трата на клубные услуги не поддерживаются.
- При удалении аккаунта остаток аннулируется операцией `REVERSAL`, а журнал
  сохраняется в обезличенном виде.
- При стандартной цене 299 RUB после трёх приглашений баланс 300 RUB позволяет
  купить 30 дней Premium, после чего останется 1 RUB.
- `GET /api/admin/premium` (Basic) — read-only обзор тарифов и оплаченных
  Premium-подписок. Ручная активация не предоставляется, чтобы не обходить
  проверенный платёжный pipeline.

### Orders and YooKassa payments

- `POST /api/me/orders` (Bearer) создаёт только заказ, но не активный абонемент.
  - `planId` и `passId` — aliases; требуется `Idempotency-Key`.
  - `type`: `MEMBERSHIP` (`subscription` и `pass` принимаются как compatibility aliases).
  - `clubId`, если передан, обязан совпадать с тарифом.
  - цена, валюта и длительность берутся из `MembershipPlan`; несовпадающие
    клиентские `priceCents`, `amountCents`, `currency`, `durationDays` отклоняются.
  - ответ содержит snapshot заказа, платеж и `confirmationUrl`.
  - без `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` сохраняется один `PENDING`
    заказ и возвращается `503`, `code=PAYMENTS_NOT_CONFIGURED`; подписка не создаётся.
- `POST /api/subscriptions` отключён (`410 DIRECT_SUBSCRIPTIONS_DISABLED`).
- `POST /api/webhooks/yookassa` не доверяет payload: backend запрашивает платёж
  у YooKassa по external ID, сверяет статус, сумму, валюту и metadata заказа,
  после чего транзакционно создаёт ровно один активный `UserSubscription`.
  Повторные webhook безопасны.
- `GET /api/me/subscriptions` сохраняет вложенные compatibility-поля и также
  отдаёт flat-поля `passId`, `title`, `planTitle`, `sportName`, `clubName`,
  `durationDays`.
- `GET /api/admin/orders` (Basic) поддерживает фильтры `status`,
  `paymentStatus`, `clubId`, `userId`.

### Clubs and training bookings

- `GET /api/clubs`, `GET /api/clubs/:id`
  - клуб содержит `tier` (`BRONZE` / `SILVER` / `GOLD`)
  - `logoUrl` / `imageUrl` и `imageUrls` / `galleryUrls` возвращаются в
    едином виде; локальные загрузки имеют относительный URL `/uploads/...`
  - `passes` и alias `subscriptions` содержат только активные тарифы
  - каждый элемент `schedules` содержит стабильный `id`, `priceCents`,
    `coachProfileId` и aliases `coachId`
- `GET /api/me/bookings`
  - Bearer required; возвращает бронирования текущего пользователя
  - фильтры: `status`, `clubId`
- `POST /api/me/bookings`
  - Bearer required
  - обязательны `scheduleEntryId` (или alias `scheduleId`) и `scheduledAt`
  - `clubId`, `coachProfileId` / `coachId` при передаче проверяются против
    расписания и клуба
  - цена всегда берётся из `ClubSchedule`; несовпадающий клиентский
    `priceCents` отклоняется с `400`
  - `platformFeeCents` фиксируется как 15% от серверной цены
  - заблокированный пользователь получает `403`

Пример запроса:

```json
{
  "scheduleEntryId": "uuid",
  "clubId": "uuid",
  "coachId": "uuid",
  "scheduledAt": "2026-08-05T18:00:00+03:00",
  "note": "Первое занятие"
}
```

Ответ содержит aliases `scheduleEntryId` / `scheduleId`,
`coachProfileId` / `coachId`, snapshot `priceCents`,
`platformFeeCents`, `currency`, `status`, клуб, тренера и даты.

### Health

- `GET /api/health`
  - используется для проверки, что сервер жив

### News

- `GET /api/news`
  - публичный feed новостей для приложения
  - production-compatible guest endpoint: Bearer-токен не требуется, лимит жёстко ограничен 100
  - query:
    - `clubId`
    - `type`
    - `limit` — строго 1–100, по умолчанию 40
  - отдает и ручные новости, и автоновости про новые стадионы/матчи
  - `type` для CMS-новостей: `news` или `sponsored`; legacy-автоновости сохраняют `STADIUM_CREATED` / `MATCH_CREATED`
  - каждая запись использует тот же DTO, что personal/admin feed: `type`, `viewCount`, `uniqueViewerCount`, `club`, `stadium`, `match`
- `POST /api/me/news/:id/view`
  - Bearer required
  - каждый успешный вызов увеличивает `viewCount`
  - только первый вызов пользователя увеличивает `uniqueViewerCount`
  - ответ: `{ newsId, viewCount, uniqueViewerCount, isFirstViewByUser }`

### Wellness Stories

- `GET /api/wellness-stories`
  - авторизация необязательна
  - query:
    - `locale` — только `ru`, по умолчанию `ru`
    - `limit` — от 1 до 100, по умолчанию 50
  - возвращает только активные, опубликованные и не удалённые истории
  - если передан валидный Bearer-токен, `viewedByMe` показывает просмотр текущим пользователем
  - если заголовок `Authorization` передан, но токен некорректен, возвращается `401`

Ответ:

```json
{
  "stories": [
    {
      "id": "uuid",
      "slug": "recovery-after-training",
      "title": "Как восстановиться после тренировки",
      "body": "Текст истории",
      "category": "routine",
      "coverImageUrl": "/uploads/wellness-stories/cover.webp",
      "readMinutes": 3,
      "sortOrder": 10,
      "locale": "ru",
      "publishedAt": "2026-07-29T12:00:00.000Z",
      "uniqueViewerCount": 24,
      "viewedByMe": false
    }
  ]
}
```

- `GET /api/wellness-stories/:identifier`
  - возвращает одну доступную историю по UUID или стабильному `slug`
  - `slug` опционален для старых и вручную созданных записей
- `POST /api/me/wellness-stories/:id/view`
  - Bearer required
  - `:id` может быть UUID или `slug`
  - фиксирует уникальный просмотр текущего пользователя
  - повторный запрос того же пользователя не увеличивает счётчик

Ответ:

```json
{
  "storyId": "uuid",
  "uniqueViewerCount": 25,
  "isFirstViewByUser": true
}
```

Категории: `nutrition`, `warmup`, `routine`, `workouts`, `balance`.

### Workout Programs

- `GET /api/workout-programs?locale=ru`
  - авторизация необязательна; некорректный переданный Bearer-токен даёт `401`
  - возвращает только активные русскоязычные программы по `sortOrder`
  - каждая программа содержит `stepCount`, `totalDurationSeconds`, `uniqueViewerCount` и `viewedByMe`
- `GET /api/workout-programs/:id`
  - `:id` — стабильный slug программы
  - возвращает карточку программы и агрегаты шагов
- `GET /api/workout-programs/:id/steps`
  - возвращает готовые структурированные шаги по `order`, без парсинга текста гайда
  - фазы: `warmup` | `work` | `rest` | `cooldown`
- `POST /api/me/workout-programs/:id/view`
  - Bearer required
  - идемпотентно фиксирует один просмотр на пару `programId + userId`
  - ответ: `{ programId, uniqueViewerCount, isFirstViewByUser }`

Ответ каталога:

```json
{
  "programs": [
    {
      "id": "stable-slug",
      "title": "Название",
      "description": "Описание",
      "estimatedMinutes": 25,
      "sortOrder": 1,
      "locale": "ru",
      "stepCount": 6,
      "totalDurationSeconds": 1200,
      "uniqueViewerCount": 24,
      "viewedByMe": false
    }
  ]
}
```

### Workout Sessions

- `GET /api/me/workout-sessions?from=&to=&limit=`
  - Bearer required
  - `from` / `to` фильтруют включительно по `finishedAt`
  - `limit`: 1–500, по умолчанию 100
- `POST /api/me/workout-sessions`
  - сохраняет одну сессию; обязательны `programId`, `finishedAt`, `durationSeconds`, `source`
- `POST /api/me/workout-sessions/bulk`
  - body: `{ "sessions": [...] }`, от 1 до 500 элементов

Поля: `startedAt` (опционально), `finishedAt`, `durationSeconds` (1–86400),
`source` (`timer` | `manual` | `imported`), `customPlan` (JSON object или `null`) и
опциональный `clientKey`. `clientKey` идемпотентен в пределах пользователя.
Для legacy-импорта без ключа применяется дедупликация по
`userId + programId + finishedAt`. При конфликте сервер возвращает уже сохранённую
версию без перезаписи (server wins).

### AI match history (storage only)

- `GET /api/me/ai-matches?limit=20` — Bearer, история текущего пользователя, лимит 1–100
- `POST /api/me/ai-matches` — Bearer, сохраняет переданные caller-ом `requestJson` и `resultJson`
- `DELETE /api/me/ai-matches/:id` — удаляет только собственную запись
- backend **не запускает AI и не генерирует рекомендации**; это только ограниченная история (не более 100 записей на пользователя, до 100 KB на JSON-поле)

### Support tickets

- `GET /api/me/support` — до 100 тикетов пользователя с публичной перепиской
- `POST /api/me/support` — body `{ "subject": "...", "message": "..." }`
- `POST /api/me/support/:id/replies` — добавить ответ пользователя; внутренние admin notes никогда не возвращаются

### Auth

- `POST /api/auth/register`
  - body:
    - `email`
    - `username`
    - optional:
      - `phone`
    - `password`
    - `firstName`
    - `lastName`
    - `city`
- `POST /api/auth/login`
  - body:
    - `identifier`
    - `password`
- `GET /api/me`
  - Bearer required
  - возвращает текущего пользователя и его ограничения
- `PATCH /api/me`
  - Bearer required
  - body:
    - `email`
    - `username`
    - optional:
      - `phone`
    - `firstName`
    - `lastName`
    - `city`
- `DELETE /api/me`
  - Bearer required
  - удаляет текущий аккаунт и связанные с ним пользовательские данные
- `POST /api/me/password/check`
  - Bearer required
  - body:
    - `password`
- `POST /api/me/password`
  - Bearer required
  - body:
    - `oldPassword`
    - `newPassword`

Логика:
- `POST /api/auth/register` и `POST /api/auth/login` возвращают `accessToken` и объект `user`
- `PATCH /api/me` используется для смены личных данных, ника и телефона
- `POST /api/me/password` используется для смены пароля
- `DELETE /api/me` используется для полного удаления собственного аккаунта
- если пользователь заблокирован на платформе, `/api/me` и авторизация могут вернуть `403`
- при удалении аккаунта backend:
  - удаляет карточку игрока, абонементы, приглашения и членства пользователя
  - если пользователь капитан и в команде есть другой участник, капитанство передается ему автоматически
  - если пользователь капитан и команда пустая кроме него, команда удаляется
  - если вместе с командой удаляются заявки на матч, backend пересчитывает слоты и автоодобрение

### Chats

Realtime:
- WebSocket endpoint: `ws://localhost:4000/api/ws/chats?token=<accessToken>`
- авторизация тем же app-токеном, что и REST: `Bearer <token>`
- удалённые и активно заблокированные пользователи не могут открыть соединение
- при истечении access token сервер закрывает соединение с кодом `4001`; клиент должен обновить token и переподключиться
- одно авторизованное соединение доставляет события чатов и пользовательских уведомлений
- realtime чатов работает поверх тех же `DirectChat` / `ChatMessage`
- REST-отправка сообщения через `POST /api/me/chats/:chatId/messages` тоже рассылает WS-события участникам чата
- REST-отметка прочтения через `POST /api/me/chats/:chatId/read` тоже рассылает WS-события участникам чата
- после подключения backend отправляет `notifications:sync` с актуальным количеством непрочитанных
- создание и изменение `UserNotification` сразу отправляется в открытое приложение; перезапуск для обновления списка не нужен

Client → server:
- `{"type":"ping"}`
- `{"type":"chat:subscribe","chatId":"..."}`
- `{"type":"chat:message:send","chatId":"...","text":"...","clientMessageId":"optional-local-id"}`
- `{"type":"chat:read","chatId":"..."}`

Server → client:
- `{"type":"connected","userId":"...","at":"..."}`
- `{"type":"pong","at":"..."}`
- `{"type":"chat:subscribed","chatId":"...","chat":{...}}`
- `{"type":"chat:message","chatId":"...","message":{...},"chat":{...},"clientMessageId":"..."}`
- `{"type":"chat:read","chatId":"...","userId":"...","readAt":"...","chat":{...}}`
- `{"type":"notifications:sync","unreadCount":3,"at":"..."}`
- `{"type":"notification:upserted","notification":{...},"unreadCount":4}`
- `{"type":"notification:updated","notification":{...},"unreadCount":3}`
- `{"type":"notifications:read-all","unreadCount":0,"readAt":"..."}`
- `{"type":"error","code":"...","message":"..."}`

Клиент должен держать соединение открытым, переподключаться после потери сети и обновлять локальный список/бейдж по событиям `notification:*` и `notifications:*`. FCM остаётся каналом для background/terminated-состояния приложения.

- `GET /api/me/chats`
  - Bearer required
  - список direct-диалогов текущего пользователя
  - query:
    - `limit`
- `POST /api/me/chats/direct`
  - Bearer required
  - создать или получить существующий direct-чат с другим пользователем
  - body:
    - `userId`
- `POST /api/me/chats/coach-profile/:coachProfileId`
  - Bearer required
  - создать или получить direct-чат с тренером по его `coachProfileId`
- `GET /api/me/chats/:chatId`
  - Bearer required
  - получить метаинформацию одного чата
- `GET /api/me/chats/:chatId/messages`
  - Bearer required
  - получить сообщения чата
  - query:
    - `limit`
    - `before` — ISO timestamp для пагинации назад
- `POST /api/me/chats/:chatId/messages`
  - Bearer required
  - body:
    - `text`
- `POST /api/me/chats/:chatId/read`
  - Bearer required
  - отметить чат прочитанным для текущего пользователя

### Users Search And Friends

Чтобы чаты не терялись, пользователей ищут по username и добавляют в друзья. При принятии заявки backend сразу создаёт (или находит) direct-чат и отдаёт `chatId` в списках друзей.

- `GET /api/users/search`
  - Bearer required
  - поиск пользователей по username (основной критерий) и имени
  - query:
    - `username` или `q` — обязателен (минимум 1 символ)
    - `limit` — необязательно (по умолчанию 20, макс. 50)
  - ответ: `{ "users": [ { user, friendshipId, friendshipStatus, relation, chatId }, ... ], "q": "..." }`
  - `relation`: `NONE` | `PENDING_OUTGOING` | `PENDING_INCOMING` | `FRIENDS`
- `GET /api/me/friends`
  - Bearer required
  - список принятых друзей
  - в каждом элементе есть `user` и `chatId` (если чат уже есть)
- `GET /api/me/friends/requests`
  - Bearer required
  - входящие заявки (`PENDING`)
- `GET /api/me/friends/outgoing`
  - Bearer required
  - исходящие заявки (`PENDING`)
- `POST /api/me/friends`
  - Bearer required
  - отправить заявку в друзья
  - body: `{ "userId": "..." }`
  - если у адресата уже есть исходящая заявка к вам — она принимается сразу и создаётся чат
- `POST /api/me/friends/:friendshipId/accept`
  - Bearer required
  - принять входящую заявку и создать/получить direct-чат
- `POST /api/me/friends/:friendshipId/reject`
  - Bearer required
  - отклонить входящую заявку
- `DELETE /api/me/friends/:userId`
  - Bearer required
  - удалить дружбу или отменить заявку; direct-чат и история сообщений сохраняются

Логика:
- чаты сейчас только direct, один на один
- один и тот же набор двух пользователей всегда получает один и тот же чат
- тренерский чат не отдельная сущность: это такой же direct-чат, просто второй участник имеет `coachProfile`
- в списке чатов backend возвращает:
  - `otherUser`
  - `lastMessage`
  - `unreadCount`
  - `lastReadAt`
- в `otherUser` приходит `isCoach`, а если это тренер, то еще и краткий `coachProfile`
- отправка сообщения обновляет `updatedAt` чата и last-read для отправителя
- читать и писать сообщения может только участник соответствующего чата

### Favorites, Personal News And Notifications

- `GET /api/me/favorite-clubs`
  - Bearer required
  - список любимых клубов пользователя
- `POST /api/me/favorite-clubs`
  - Bearer required
  - body:
    - `clubId`
- `DELETE /api/me/favorite-clubs/:clubId`
  - Bearer required
- `GET /api/me/news`
  - Bearer required
  - персональная лента новостей
  - query:
    - `favoritesOnly`
    - `clubId`
    - `type`
    - `limit`
- `GET /api/me/notifications`
  - Bearer required
  - уведомления по любимым клубам
  - query:
    - `unreadOnly`
    - `type`
    - `limit`
- `PATCH /api/me/notifications/:id/read`
  - Bearer required
  - body:
    - optional:
      - `isRead`
- `POST /api/me/notifications/read-all`
  - Bearer required

Логика:
- favorite-клубы хранятся отдельно для каждого пользователя
- `GET /api/me/news` возвращает общую новостную ленту, но новости любимых клубов поднимаются вверх
- в `GET /api/me/news` у клубной новости будет `isFavoriteClubNews: true`, если клуб находится в избранном пользователя
- при создании новости с `clubId` backend создает уведомления всем пользователям, у которых этот клуб в избранном на момент публикации
- `GET /api/me/notifications` возвращает сохраненные пользовательские уведомления
- уведомления можно отмечать прочитанными по одному или массово

### Stadiums And Matches

- `GET /api/stadiums`
  - query: `cityId`, `city`
- `GET /api/matches`
  - query: `cityId`, `stadiumId`, `status`
- `GET /api/matches/:id`

Логика:
- `GET /api/stadiums` используется приложением для карты и списка стадионов
- `GET /api/matches` отдает матчи по стадиону/городу/статусу
- `GET /api/matches/:id` отдает детали одного матча и его регистрации

### Ecosystem Sports And Clubs

- `GET /api/sports`
  - список видов спорта
- `GET /api/clubs`
  - query:
    - `sportId`
    - `sportCode`
    - `cityId`
    - `city`
    - `age`
    - `tier`
    - `q` / `name` — поиск по названию, адресу или городу клуба (`contains`, без регистра)
  - используется для главного экрана будущих приложений
  - фильтрует клубы/залы из нашей БД по городу, виду спорта, возрасту, названию и адресу
- `GET /api/search/places`
  - единый поиск локальных клубов и адресов/объектов OpenStreetMap через Nominatim
  - query:
    - `q` — обязательно, минимум 2 символа; например `улица Титова`
    - `city` — необязательное уточнение города
    - `cityId` — необязательный UUID города из нашей БД; имеет приоритет над `city`
    - `limit` — максимум локальных клубов (по умолчанию 10, максимум 25)
    - `externalLimit` — максимум OSM-результатов (по умолчанию 5, максимум 10)
    - `countryCodes` — ISO-коды стран через запятую (по умолчанию `ru`)
    - `language` — язык Nominatim (по умолчанию `ru`)
    - `external=false` — искать только в нашей БД
  - ответ: `{ query, clubs, places, externalStatus, externalCached, attribution }`
  - `clubs` — полноценные объекты `SportClub` из нашей БД
  - `places` — OSM-объекты с `name`, `displayName`, `latitude`, `longitude`, `boundingBox`, `address`, `mapUrl`
  - `externalStatus`: `OK` | `UNAVAILABLE` | `DISABLED`; при недоступности Nominatim локальные результаты всё равно возвращаются
  - клиент обязан показывать `attribution` — `© OpenStreetMap contributors`
  - публичный Nominatim запрещает autocomplete-запросы на каждое нажатие клавиши: вызывайте endpoint после явного submit либо после достаточной паузы и только когда пользователь действительно ищет
  - endpoint дополнительно ограничен 20 запросами в минуту на IP
- `GET /api/clubs/:id`
  - подробная информация по клубу/залу
  - возвращает адрес, контакты, фото, тренеров, trainer cards, расписание, ссылку на Яндекс.Карты
- `GET /api/coach-profiles/search`
  - публичный подбор карточек тренеров (из `CoachProfile`) по городу **клуба**, к которому привязана анкета
  - query:
    - `city` — название города (без регистра), **или** `cityId` — UUID города (**одно из двух обязательно**)
    - `sportCode` — опционально; нормализуется как у `/api/clubs`
    - `limit` — необязательно (по умолчанию 24, макс. 50)
  - ответ: `{ "coaches": [ serialized CoachProfile, ... ] }`
- `GET /api/subscription-plans`
  - query:
    - `sportId`
    - `clubId`
    - `active`
  - список доступных абонементов
- `POST /api/me/orders`
  - Bearer required; начинает безопасную оплату YooKassa (см. выше)
- `GET /api/me/subscriptions`
  - Bearer required
  - query:
    - `sportId`
    - `clubId`
    - `status`
  - список абонементов текущего пользователя
- `GET /api/me/subscriptions/notifications`
  - Bearer required
  - возвращает уведомления по абонементам, которые скоро сгорят

Логика:
- пользовательский аккаунт один для всех видов спорта
- клубы и залы разделяются по виду спорта
- у клуба есть обложка `imageUrl` и галерея `galleryUrls`
- у клуба есть контактные поля:
  - `contactPhone`
  - `contactEmail`
  - `websiteUrl`
  - `telegramUrl`
  - `vkUrl`
  - `instagramUrl`
- `GET /api/clubs` и `GET /api/clubs/:id` возвращают embedded trainer cards в поле `coachProfiles`
- у клуба можно хранить список пользователей, которые добавили его в избранное
- абонемент относится к виду спорта, опционально к конкретному клубу/залу
- `GET /api/me/subscriptions` всегда возвращает только абонементы текущего пользователя по Bearer-токену
- `GET /api/me/subscriptions` возвращает массив абонементов в той же модели, что и `GET /api/admin/subscriptions`
- активный абонемент создаётся только после проверенного webhook YooKassa
- уведомление о сгорающем абонементе возвращается, если до конца осталось 7 дней или меньше

### Coach Profiles

- `GET /api/me/coach-profile`
  - Bearer required
  - получить свою текущую trainer card
- `PUT /api/me/coach-profile`
  - Bearer required
  - create/update trainer card
  - body:
    - `firstName`
    - `lastName`
    - `phone`
    - optional:
      - `clubId`
      - `experienceYears`
      - `description`
      - `photoUrl`
- `POST /api/me/coach-profile/photo`
  - Bearer required
  - multipart/form-data
  - field:
    - `file`
  - возвращает `url`

Логика:
- привязка тренера к клубу опциональна
- тренер сам заполняет свои данные
- телефон тренера обязателен
- если тренер привязан к клубу, то при просмотре клуба его карточка приходит в `coachProfiles`
- поиск `GET /api/coach-profiles/search` работает только по тренерам, у которых есть привязка к клубу
- в карточке тренера хранятся:
  - имя
  - фамилия
  - телефон
  - стаж
  - описание тренера
  - фото

### Match Registrations

- `GET /api/registrations`
  - query: `matchId`, `status`, `captainLogin`, `teamId`
- `POST /api/registrations`
  - body: `matchId`, `teamName`, `captainName`, `captainLogin`
  - optional: `note`, `playersCount`

Поведение:
- заявка создается для текущей команды пользователя
- backend использует актуальные данные команды и капитана
- без карточки футболиста заявка не создается
- без команды заявка не создается
- если у команды уже есть активная заявка на матч, новая не создается
- при включенном `AUTO_FIRST_COME` заявка может сразу получить статус `APPROVED`
- если мест нет, заявка остается `PENDING`
- если `APPROVED` команда снимается с матча, backend может автоматически поднять следующую `PENDING`

### Player Cards

- `GET /api/player-card-options`
  - возвращает все допустимые значения для формы карточки игрока:
    - `positions`
    - `preferredFeet`
    - `formats`
    - `skillTags`
    - `statuses`
- `GET /api/players`
  - query: `cityId`, `city`, `position`, `skill`, `minRating`, `maxRating`, `lookingForTeam`, `q`
  - используется для поиска игроков во вкладке `Игроки`
  - показывает публичные карточки игроков вместе с текущей командой, если она есть
- `GET /api/players/:userId`
  - получить публичную карточку конкретного игрока по `userId`
- `GET /api/me/player-card`
  - Bearer required
  - получить свою текущую карточку игрока
- `PUT /api/me/player-card`
  - Bearer required
  - create/update одной и той же карточки игрока
  - body:
    - `position`
    - `preferredFoot`
    - `favoriteFormat`
    - optional:
      - `heightCm`
      - `weightKg`
      - `age`
      - `bio`
      - `avatarUrl`
      - `rating`
      - `city`
    - arrays:
      - `skillTags`
      - `statuses`
- `POST /api/me/player-card/avatar`
  - Bearer required
  - multipart/form-data
  - field:
    - `file`
  - сохраняет файл в `/uploads/players`
  - если карточка игрока уже существует, сразу обновляет `avatarUrl` в БД
  - возвращает:
    - `url`
    - `savedToDatabase`
    - `playerCard`

Логика:
- сильные стороны ограничены списком `PACE`, `SHOOTING`, `PASSING`, `DRIBBLING`, `STAMINA`, `DEFENDING`
- статусы ограничены списком `LOOKING_FOR_TEAM`, `READY_TO_PLAY`, `CAPTAIN`, `WITHOUT_TEAM`
- пользователь может выбрать максимум 3 сильных стороны
- пользователь может выбрать максимум 3 статуса
- карточка используется в публичном поиске игроков и в логике заявок на матч
- `PUT /api/me/player-card` работает как `upsert`
  - если карточки нет, создаст
  - если карточка уже есть, обновит
- `POST /api/me/player-card/avatar` хранит сам файл на диске backend, а в БД хранится путь в `PlayerCard.avatarUrl`

Обязательные поля для `PUT /api/me/player-card`:
- `position`
- `preferredFoot`
- `favoriteFormat`
- `skillTags`
- `statuses`

### Teams

- `GET /api/me/team`
  - Bearer required
  - получить текущую команду пользователя
- `POST /api/me/team`
  - Bearer required
  - body:
    - `name`
  - создает новую команду, если пользователь еще не состоит ни в одной
- `POST /api/me/team/invitations`
  - Bearer required
  - body:
    - `teamId`
    - `identifier`
  - `identifier` это логин или email игрока
- `GET /api/me/team-invitations`
  - Bearer required
  - получить входящие приглашения в команду
- `POST /api/me/team-invitations/:id/accept`
  - Bearer required
  - принять приглашение
- `POST /api/me/team-invitations/:id/reject`
  - Bearer required
  - отклонить приглашение
- `PATCH /api/me/team/members/:memberId`
  - Bearer required
  - изменить роль и игровую позицию участника
  - body:
    - `role`
    - `fieldPosition`
- `POST /api/me/team/members/:memberId/transfer-captain`
  - Bearer required
  - передать капитанство выбранному участнику команды
- `DELETE /api/me/team/members/:memberId`
  - Bearer required
  - удалить участника из команды
- `GET /api/teams/:id/public`
  - публичные сведения о команде

Логика:
- пользователь может иметь только одну текущую команду
- капитан команды может приглашать игроков по логину или email
- капитан управляет ролями участников
- капитан задает игровые позиции состава
- обычный участник не управляет командой
- удалить можно только не-капитана
- капитан не может удалить сам себя
- капитан может передать права капитана другому участнику команды

Роли участников:
- `CAPTAIN`
- `MEMBER`
- `SUBSTITUTE`

Игровые позиции:
- `GK`
- `DF`
- `MF`
- `FW`

### App Ecosystem Flow

Для будущих приложений под бокс и другие виды спорта базовый сценарий такой:

1. `POST /api/auth/register` или `POST /api/auth/login`
2. `GET /api/sports`
3. `GET /api/clubs?sportCode=BOXING&city=Москва&age=18`
4. `GET /api/clubs/:id`
5. `GET /api/subscription-plans?clubId=...`
6. `POST /api/me/orders` с `Idempotency-Key`
7. `GET /api/me/subscriptions`
8. `GET /api/me/subscriptions/notifications`

## Admin API

Все эндпоинты ниже работают через Basic Auth и начинаются с `/api/admin`.

### Cities

- `GET /api/admin/cities`
- `POST /api/admin/cities`
  - body:
    - `name`
- `GET /api/admin/cities/:id`
- `PUT /api/admin/cities/:id`
  - body:
    - `name`
- `DELETE /api/admin/cities/:id`

### Stadiums

- `GET /api/admin/stadiums`
  - query:
    - `cityId`
- `POST /api/admin/stadiums`
  - body:
    - `name`
    - `address`
    - `cityId`
    - `latitude`
    - `longitude`
    - optional:
      - `description`
      - `imageUrl`
- `GET /api/admin/stadiums/:id`
- `PUT /api/admin/stadiums/:id`
  - body:
    - `name`
    - `address`
    - `cityId`
    - `latitude`
    - `longitude`
    - optional:
      - `description`
      - `imageUrl`
- `DELETE /api/admin/stadiums/:id`

Логика:
- при создании стадиона backend автоматически создает новость типа `STADIUM_CREATED`

### Matches

- `GET /api/admin/matches`
  - query:
    - `cityId`
    - `stadiumId`
    - `status`
- `POST /api/admin/matches`
  - body:
    - `stadiumId`
    - `startTime`
    - `endTime`
    - `format`
    - `maxTeams`
    - `status`
    - optional:
      - `priceCents`
      - `currency`
      - `approvalMode`
      - `description`
- `GET /api/admin/matches/:id`
- `PUT /api/admin/matches/:id`
  - body:
    - любые изменяемые поля матча
- `DELETE /api/admin/matches/:id`

Логика:
- при создании матча backend автоматически создает новость типа `MATCH_CREATED`
- `approvalMode` может быть:
  - `MANUAL`
  - `AUTO_FIRST_COME`

### Teams

- `GET /api/admin/teams`
- `POST /api/admin/teams`
- `GET /api/admin/teams/:id`
- `PUT /api/admin/teams/:id`
- `DELETE /api/admin/teams/:id`

### Users

- `GET /api/admin/users`
  - query: `role`, `cityId`, `q`, `blocked`
- `POST /api/admin/users`
  - body:
    - `email`
    - `name`
    - `passwordHash`
    - optional:
      - `username`
      - `phone`
      - `firstName`
      - `lastName`
      - `role`
      - `cityId`
- `PUT /api/admin/users/:id`
  - body:
    - любые изменяемые поля пользователя
    - включая `phone`
- `PATCH /api/admin/users/:id/moderation`
  - body:
    - optional:
      - `username`
      - `phone`
      - `role`
      - `isBlocked`
      - `blockReason`
      - `blockedUntil`
      - `matchBanUntil`
- `DELETE /api/admin/users/:id`

Логика:
- через moderation можно:
  - заблокировать пользователя на платформе
  - выдать бан на подачу заявок
  - снять ограничения
  - сменить ник
  - изменить роль

### Registrations

- `GET /api/admin/registrations`
  - query: `matchId`, `status`, `captainLogin`
- `POST /api/admin/registrations`
- `PATCH /api/admin/registrations/:id/status`
- `DELETE /api/admin/registrations/:id`

Через админские регистрации можно:
- просматривать все заявки
- вручную принимать заявку
- отклонять заявку
- снимать команду с матча

Если матч работает в режиме автоодобрения, backend сам поднимет следующую `PENDING` заявку после освобождения слота.

### News

- `GET /api/admin/news`
  - список всех новостей для админки
  - query:
    - `clubId`
    - `type`
- `POST /api/admin/news`
  - body:
    - `title`
    - `body`
    - optional:
      - `clubId`
      - `type`: `news` | `sponsored` (по умолчанию `news`)
      - `imageUrl`
      - `publishedAt`
- `PUT /api/admin/news/:id`
  - body:
    - `title`
    - `body`
    - optional:
      - `clubId`
      - `type`: `news` | `sponsored`
      - `imageUrl`
      - `publishedAt`
- `DELETE /api/admin/news/:id`
- `POST /api/admin/news/:id/image`
  - `multipart/form-data`, поле `file`
  - JPEG, PNG, WebP или GIF, максимум 5 MB
  - заменяет прежний локальный файл безопасно

Логика:
- ручные новости создаются через `/api/admin/news`
- если у ручной новости указан `clubId`, она считается клубной новостью
- при создании клубной новости backend рассылает уведомления пользователям, у которых этот клуб в избранном
- автоновости создаются backend автоматически при создании новых стадионов и матчей
- в приложении весь feed читается через `GET /api/news`
- все admin/public/personal DTO содержат `viewCount` и `uniqueViewerCount`
- аналитика хранится в пользовательских rows с каскадным удалением при GDPR-удалении аккаунта

### Wellness Stories

- `GET /api/admin/wellness-stories`
  - список русскоязычных историй с `uniqueViewerCount`
  - query:
    - `includeDeleted=true` — включить мягко удалённые записи
- `GET /api/admin/wellness-stories/:id`
- `POST /api/admin/wellness-stories`
- `PUT /api/admin/wellness-stories/:id`
  - body:
    - `title`
    - `body`
    - `category`: `nutrition` | `warmup` | `routine` | `workouts` | `balance`
    - `readMinutes`: целое число от 1 до 120
    - `sortOrder`: целое число
    - `isActive`: boolean
    - optional:
      - `slug` — уникальный стабильный идентификатор: строчные латинские буквы, цифры и дефисы, до 120 символов
      - `coverImageUrl`
      - `publishedAt`
      - `locale` — сейчас только `ru`
- `POST /api/admin/wellness-stories/import`
  - принимает объект `{"stories": [...]}` с явно переданными русскими историями
  - для каждой истории обязателен уникальный `slug`; контент не генерируется и не дополняется заглушками
  - все элементы сначала валидируются, затем транзакционно создаются или обновляются по `slug`
  - повторный импорт идемпотентно обновляет ту же запись, сохраняя UUID
  - максимум 500 историй за запрос
- `DELETE /api/admin/wellness-stories/:id`
  - soft delete: запись получает `deletedAt`, а `isActive` становится `false`
- `POST /api/admin/wellness-stories/:id/cover`
  - `multipart/form-data`
  - поле `file`
  - JPEG, PNG, WebP или GIF, максимум 5 MB
  - возвращает относительный `url` и обновлённый объект `story`

Логика:
- публичная лента сортируется сначала по `sortOrder`, затем по `publishedAt`
- активная история становится публичной только после `publishedAt`
- уникальный просмотр хранится один раз для пары `storyId + userId`
- `uniqueViewerCount` вычисляется по записям просмотров и автоматически остаётся корректным при удалении пользователя
- удалённые истории и их аналитика сохраняются для админки, но не возвращаются клиенту

### Workout Programs

- `GET /api/admin/workout-programs`
- `GET /api/admin/workout-programs/:id`
- `POST /api/admin/workout-programs`
- `PUT /api/admin/workout-programs/:id`
- `DELETE /api/admin/workout-programs/:id`
  - ID — обязательный неизменяемый slug из строчных латинских букв, цифр и дефисов
  - поля: `title`, `subtitle`, `description`, `guide`, `iconKey`, `gradientStart`, `gradientEnd`, `estimatedMinutes`, `sortOrder`, `isActive`, `locale=ru`
  - удаление каскадно удаляет шаги, просмотры и локальные иллюстрации
- `GET /api/admin/workout-programs/:id/steps`
- `POST /api/admin/workout-programs/:id/steps`
- `PUT /api/admin/workout-programs/:id/steps/:stepId`
- `DELETE /api/admin/workout-programs/:id/steps/:stepId`
  - шаг содержит `phase`, `title`, `description`, `durationSeconds`, `poseIndex` и `order`
- `PUT /api/admin/workout-programs/:id/steps/reorder`
  - body: `{ "stepIds": ["id-в-первой-позиции", "id-во-второй-позиции"] }`
  - массив должен содержать все шаги программы ровно один раз; перестановка транзакционная
- `POST /api/admin/workout-programs/:id/steps/:stepId/illustration`
  - `multipart/form-data`, поле `file`
  - JPEG, PNG, WebP или GIF, максимум 5 MB
  - новая иллюстрация заменяет старую с удалением прежнего локального файла

Ответы программ содержат рассчитанные `stepCount`, `totalDurationSeconds` и `uniqueViewerCount`. Контент программ автоматически не создаётся и не импортируется.

### Workout Analytics

- `GET /api/admin/workout-analytics?from=&to=&popularLimit=`
- диапазон по `finishedAt` по умолчанию 30 дней и не может превышать 366 дней
- `popularLimit`: 1–50
- ответ содержит ограниченные агрегаты: число сессий, уникальных пользователей, суммарную/среднюю длительность и популярные программы
- раздел «Аналитика тренировок» в admin позволяет менять диапазон и видеть эти метрики

### Manual Push Campaigns

- `GET/POST /api/admin/push-campaigns`
- `GET /api/admin/push-campaigns/:id/preview` — размер и пример аудитории без отправки
- `POST /api/admin/push-campaigns/:id/send` — идемпотентная ручная отправка
- `GET/POST /api/admin/push-campaigns/templates`
- `PUT/DELETE /api/admin/push-campaigns/templates/:id`
- сегменты: `ALL_USERS`, `SELECTED_USERS`, `FAVORITE_CLUB`; максимум 2000 получателей на кампанию
- in-app notification сохраняется отдельно от FCM-доставки; без FCM credentials кампания получает `SKIPPED`, `pushSentCount=0`, а не ложный `SENT`
- сохраняются статусы и счётчики аудитории, in-app записей, успешных FCM token deliveries, ошибок и пропусков

### Support Queue

- `GET /api/admin/support?status=&priority=` — очередь до 250 тикетов
- `GET /api/admin/support/:id` — тикет, публичные ответы и внутренние заметки
- `PATCH /api/admin/support/:id` — изменить `status` и/или `priority`
- `POST /api/admin/support/:id/replies` — ответ пользователю и статус `WAITING_USER`
- `POST /api/admin/support/:id/notes` — внутренняя заметка, не видимая пользователю
- admin-раздел «Поддержка» предоставляет список, detail, статусы, приоритеты, replies и notes

### Ecosystem Sports

- `GET /api/admin/sports`
- `POST /api/admin/sports`
  - body:
    - `code`
    - `name`
    - optional:
      - `description`
- `GET /api/admin/sports/:id`
- `PUT /api/admin/sports/:id`
  - body:
    - optional:
      - `code`
      - `name`
      - `description`
- `DELETE /api/admin/sports/:id`

Логика:
- `code` хранится в верхнем регистре
- базовые виды спорта `FOOTBALL` и `BOXING` создаются автоматически при старте backend

### Ecosystem Clubs

- `GET /api/admin/clubs`
  - query:
    - `sportId`
    - `sportCode`
    - `cityId`
    - `city`
    - `age`
- `POST /api/admin/clubs`
  - body:
    - `sportId`
    - `name`
    - `address`
    - optional:
      - `cityId`
      - `kind`
      - `description`
      - `latitude`
      - `longitude`
      - `imageUrl`
      - `galleryUrls`
      - `yandexMapsUrl`
      - `contactPhone`
      - `contactEmail`
      - `websiteUrl`
      - `telegramUrl`
      - `vkUrl`
      - `instagramUrl`
      - `minAge`
      - `maxAge`
      - `coaches`
      - `schedules`
- `GET /api/admin/clubs/:id`
- `PUT /api/admin/clubs/:id`
  - body:
    - все поля клуба/зала
- `DELETE /api/admin/clubs/:id`

Пример `schedules`:

```json
[
  {
    "title": "Вечерняя группа",
    "dayOfWeek": 1,
    "startTime": "18:00",
    "endTime": "19:30",
    "ageGroup": "16+",
    "coachName": "Иван Петров",
    "note": "Базовая техника"
  }
]
```

Логика:
- клуб/зал всегда относится к конкретному виду спорта
- у клуба можно хранить и главное фото `imageUrl`, и галерею `galleryUrls`
- контакты и соцсети клуба редактируются прямо в клубе
- тренерский состав хранится массивом строк `coaches`
- полные trainer cards живут отдельно и подтягиваются в `coachProfiles`
- расписание хранится отдельными строками `schedules`
- фильтр `age` проверяет `minAge` и `maxAge`

### Ecosystem Subscription Plans

- `GET /api/admin/subscription-plans`
  - query:
    - `sportId`
    - `clubId`
    - `active`
- `POST /api/admin/subscription-plans`
  - body:
    - `sportId`
    - `title`
    - `priceCents`
    - `durationDays`
    - optional:
      - `clubId`
      - `description`
      - `currency`
      - `isActive`
- `GET /api/admin/subscription-plans/:id`
- `PUT /api/admin/subscription-plans/:id`
  - body:
    - все поля абонемента
- `DELETE /api/admin/subscription-plans/:id`

Логика:
- абонемент может быть общим для вида спорта или привязанным к конкретному клубу/залу
- цена хранится в копейках через `priceCents`
- срок действия хранится в днях через `durationDays`

### Ecosystem User Subscriptions

- `GET /api/admin/subscriptions`
  - query:
    - `sportId`
    - `clubId`
    - `userId`
    - `status`
- `PATCH /api/admin/subscriptions/:id/status`
  - body:
    - `status`

Статусы:
- `ACTIVE`
- `EXPIRED`
- `CANCELLED`

Логика:
- здесь админ видит оплаченные абонементы пользователей
- этот endpoint только для админки через Basic Auth
- приложение не должно использовать `/api/admin/subscriptions` для профиля
- статус можно вручную поменять, например отменить абонемент

### Uploads

- `POST /api/admin/uploads`
  - multipart/form-data
  - field:
    - `file`
  - возвращает `url`

## Static Files

Загруженные файлы раздаются через:

- `GET /uploads/...`

## Notes

- backend один для приложения и админки
- основная база данных: PostgreSQL
- локально проект ожидает порт `4000`

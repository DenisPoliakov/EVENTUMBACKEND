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

- публичный поиск карточек тренеров по городу клуба: `GET /api/coach-profiles/search`

- пользовательский список абонементов закреплен за `GET /api/me/subscriptions`
- добавлено удаление собственного аккаунта через `DELETE /api/me`
- админское удаление пользователя теперь чистит связанные сущности пользователя корректно

## Быстрые правила

- локальный backend по умолчанию работает на `http://localhost:4000`
- все app-эндпоинты начинаются с `/api/...`
- все admin-эндпоинты начинаются с `/api/admin/...`
- для профиля, команды и карточки игрока используется логика `my resource`
- если ручка требует токен, без `Bearer` вернется `401`
- профиль не должен использовать `/api/admin/subscriptions`
- для экрана абонементов в приложении используется `GET /api/me/subscriptions`
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

### Health

- `GET /api/health`
  - используется для проверки, что сервер жив

### News

- `GET /api/news`
  - публичный feed новостей для приложения
  - отдает и ручные новости, и автоновости про новые стадионы/матчи

### Auth

- `POST /api/auth/register`
  - body:
    - `email`
    - `username`
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
- `PATCH /api/me` используется для смены личных данных
- `POST /api/me/password` используется для смены пароля
- `DELETE /api/me` используется для полного удаления собственного аккаунта
- если пользователь заблокирован на платформе, `/api/me` и авторизация могут вернуть `403`
- при удалении аккаунта backend:
  - удаляет карточку игрока, абонементы, приглашения и членства пользователя
  - если пользователь капитан и в команде есть другой участник, капитанство передается ему автоматически
  - если пользователь капитан и команда пустая кроме него, команда удаляется
  - если вместе с командой удаляются заявки на матч, backend пересчитывает слоты и автоодобрение

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
  - используется для главного экрана будущих приложений
  - фильтрует клубы/залы по городу, виду спорта и возрасту
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
- `POST /api/subscriptions`
  - Bearer required
  - body:
    - `planId`
    - optional:
      - `startsAt`
  - создает оплаченный абонемент пользователя
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
- абонемент относится к виду спорта, опционально к конкретному клубу/залу
- `GET /api/me/subscriptions` всегда возвращает только абонементы текущего пользователя по Bearer-токену
- `GET /api/me/subscriptions` возвращает массив абонементов в той же модели, что и `GET /api/admin/subscriptions`
- `POST /api/subscriptions` сейчас фиксирует успешную оплату на стороне backend и возвращает уведомление `PAYMENT_SUCCESS`
- уведомление о сгорающем абонементе возвращается, если до конца осталось 7 дней или меньше

### Coach Profiles

- `GET /api/me/coach-profile`
  - Bearer required
  - получить свою текущую trainer card
- `PUT /api/me/coach-profile`
  - Bearer required
  - create/update trainer card
  - body:
    - `clubId`
    - `firstName`
    - `lastName`
    - optional:
      - `experienceYears`
      - `achievements`
      - `photoUrl`
- `POST /api/me/coach-profile/photo`
  - Bearer required
  - multipart/form-data
  - field:
    - `file`
  - возвращает `url`

Логика:
- тренерская карточка привязывается к одному клубу
- тренер сам заполняет свои данные
- при просмотре клуба карточки тренеров приходят прямо в `coachProfiles`
- в карточке тренера хранятся:
  - имя
  - фамилия
  - стаж
  - достижения
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
  - возвращает `url`

Логика:
- сильные стороны ограничены списком `PACE`, `SHOOTING`, `PASSING`, `DRIBBLING`, `STAMINA`, `DEFENDING`
- статусы ограничены списком `LOOKING_FOR_TEAM`, `READY_TO_PLAY`, `CAPTAIN`, `WITHOUT_TEAM`
- пользователь может выбрать максимум 3 сильных стороны
- пользователь может выбрать максимум 3 статуса
- карточка используется в публичном поиске игроков и в логике заявок на матч
- `PUT /api/me/player-card` работает как `upsert`
  - если карточки нет, создаст
  - если карточка уже есть, обновит

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
6. `POST /api/subscriptions`
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
      - `firstName`
      - `lastName`
      - `role`
      - `cityId`
- `PUT /api/admin/users/:id`
  - body:
    - любые изменяемые поля пользователя
- `PATCH /api/admin/users/:id/moderation`
  - body:
    - optional:
      - `username`
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
- `POST /api/admin/news`
  - body:
    - `title`
    - `body`
    - optional:
      - `imageUrl`
      - `publishedAt`
- `PUT /api/admin/news/:id`
  - body:
    - `title`
    - `body`
    - optional:
      - `imageUrl`
      - `publishedAt`
- `DELETE /api/admin/news/:id`

Логика:
- ручные новости создаются через `/api/admin/news`
- автоновости создаются backend автоматически при создании новых стадионов и матчей
- в приложении весь feed читается через `GET /api/news`

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

# EVENTUM API

Этот файл описывает API backend проекта `EVENTUM`.

Базовый адрес локально:

```text
http://localhost:4000
```

Форматы авторизации:
- приложение: `Authorization: Bearer <token>`
- админка: `Authorization: Basic <base64(user:password)>`

## Быстрые правила

- локальный backend по умолчанию работает на `http://localhost:4000`
- все app-эндпоинты начинаются с `/api/...`
- все admin-эндпоинты начинаются с `/api/admin/...`
- для профиля, команды и карточки игрока используется логика `my resource`
- если ручка требует токен, без `Bearer` вернется `401`

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
- `PATCH /api/me` используется для смены личных данных
- `POST /api/me/password` используется для смены пароля
- если пользователь заблокирован на платформе, `/api/me` и авторизация могут вернуть `403`

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

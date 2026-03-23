# EVENTUM API

Этот файл описывает API backend проекта `EVENTUM`.

Базовый адрес локально:

```text
http://localhost:4000
```

Форматы авторизации:
- приложение: `Authorization: Bearer <token>`
- админка: `Authorization: Basic <base64(user:password)>`

## Public And App API

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `PATCH /api/me`
- `POST /api/me/password/check`
- `POST /api/me/password`

### Stadiums And Matches

- `GET /api/stadiums`
  - query: `cityId`, `city`
- `GET /api/matches`
  - query: `cityId`, `stadiumId`, `status`
- `GET /api/matches/:id`

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

### Player Cards

- `GET /api/player-card-options`
- `GET /api/players`
  - query: `cityId`, `city`, `position`, `skill`, `minRating`, `maxRating`, `lookingForTeam`, `q`
- `GET /api/players/:userId`
- `GET /api/me/player-card`
- `PUT /api/me/player-card`
- `POST /api/me/player-card/avatar`

Логика:
- сильные стороны ограничены списком `PACE`, `SHOOTING`, `PASSING`, `DRIBBLING`, `STAMINA`, `DEFENDING`
- статусы ограничены списком `LOOKING_FOR_TEAM`, `READY_TO_PLAY`, `CAPTAIN`, `WITHOUT_TEAM`
- пользователь может выбрать максимум 3 сильных стороны
- пользователь может выбрать максимум 3 статуса
- карточка используется в публичном поиске игроков и в логике заявок на матч

### Teams

- `GET /api/me/team`
- `POST /api/me/team`
- `POST /api/me/team/invitations`
- `GET /api/me/team-invitations`
- `POST /api/me/team-invitations/:id/accept`
- `POST /api/me/team-invitations/:id/reject`
- `PATCH /api/me/team/members/:memberId`
- `GET /api/teams/:id/public`

Логика:
- пользователь может иметь только одну текущую команду
- капитан команды может приглашать игроков по логину или email
- капитан управляет ролями участников
- капитан задает игровые позиции состава
- обычный участник не управляет командой

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
- `GET /api/admin/cities/:id`
- `PUT /api/admin/cities/:id`
- `DELETE /api/admin/cities/:id`

### Stadiums

- `GET /api/admin/stadiums`
- `POST /api/admin/stadiums`
- `GET /api/admin/stadiums/:id`
- `PUT /api/admin/stadiums/:id`
- `DELETE /api/admin/stadiums/:id`

### Matches

- `GET /api/admin/matches`
- `POST /api/admin/matches`
- `GET /api/admin/matches/:id`
- `PUT /api/admin/matches/:id`
- `DELETE /api/admin/matches/:id`

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
- `PUT /api/admin/users/:id`
- `PATCH /api/admin/users/:id/moderation`
- `DELETE /api/admin/users/:id`

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

### Uploads

- `POST /api/admin/uploads`

## Static Files

Загруженные файлы раздаются через:

- `GET /uploads/...`

## Notes

- backend один для приложения и админки
- основная база данных: PostgreSQL
- локально проект ожидает порт `4000`

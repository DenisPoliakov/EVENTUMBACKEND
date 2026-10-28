# Команды

## Purpose

Команда пользователя (капитан, состав, приглашения) и админский справочник команд. Пользовательские маршруты — `src/routes/teamHub.js`, админские — `src/routes/teams.js`.

## Requirements

### Requirement: Команда текущего пользователя

`GET /api/me/team` и `POST /api/me/team` MUST требовать Bearer. Создание команды делает автора капитаном.

#### Scenario: Создание без сессии

- GIVEN Bearer отсутствует
- WHEN клиент вызывает `POST /api/me/team`
- THEN статус 401

### Requirement: Приглашения и состав

Система SHALL поддерживать:

- `POST /api/me/team/invitations`
- `GET /api/me/team-invitations`
- `POST /api/me/team-invitations/:id/accept`
- `POST /api/me/team-invitations/:id/reject`
- `PATCH /api/me/team/members/:memberId`
- `POST /api/me/team/members/:memberId/transfer-captain`
- `DELETE /api/me/team/members/:memberId`

Принять приглашение MAY только адресат. Передать капитанство MAY только текущий капитан.

#### Scenario: Чужое приглашение

- GIVEN приглашение адресовано другому пользователю
- WHEN текущий пользователь вызывает `POST /api/me/team-invitations/:id/accept`
- THEN система не переводит приглашение в `ACCEPTED` для этого пользователя

### Requirement: Публичная карточка команды

`GET /api/teams/:id/public` SHALL быть доступен без токена и отдаёт публичные поля команды.

#### Scenario: Несуществующая команда

- GIVEN команды с таким `id` нет
- WHEN клиент вызывает `GET /api/teams/:id/public`
- THEN статус 404

### Requirement: Админский справочник

`/api/admin/teams` SHALL поддерживать `GET`, `POST`, `GET /:id`, `PUT /:id`, `DELETE /:id` при Basic Auth.

#### Scenario: Удаление команды админом

- GIVEN администратор авторизован и команда существует
- WHEN он вызывает `DELETE /api/admin/teams/:id`
- THEN команда удалена

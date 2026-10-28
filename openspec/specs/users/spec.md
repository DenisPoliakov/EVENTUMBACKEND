# Пользователи в админке

## Purpose

Управление учётными записями из админки. Все маршруты ниже требуют Basic Auth и живут в `src/routes/users.js`.

## Requirements

### Requirement: Список и карточка

`GET /api/admin/users` SHALL возвращать пользователей. `POST /api/admin/users` создаёт пользователя, `PUT /api/admin/users/:id` обновляет его. Без Basic Auth каждый из этих маршрутов MUST отвечать 401.

#### Scenario: Список без входа в админку

- GIVEN заголовок Basic отсутствует
- WHEN клиент вызывает `GET /api/admin/users`
- THEN статус 401

### Requirement: Модерация

`PATCH /api/admin/users/:id/moderation` SHALL менять блокировку платформы и ограничение заявок на матчи для указанного пользователя.

#### Scenario: Блокировка пользователя

- GIVEN администратор авторизован и пользователь существует
- WHEN он вызывает `PATCH /api/admin/users/:id/moderation` с активной блокировкой
- THEN последующий вход этого пользователя через `POST /api/auth/login` получает 403, пока блокировка активна

### Requirement: Удаление

`DELETE /api/admin/users/:id` SHALL удалять учётную запись через то же каскадное удаление, что и `DELETE /api/me`.

#### Scenario: Удаление существующего пользователя

- GIVEN администратор авторизован и пользователь есть в базе
- WHEN он вызывает `DELETE /api/admin/users/:id`
- THEN пользователь больше не находится по этому `id`

# Поддержка

## Purpose

Обращения пользователя и работа администратора с тикетами. Источники: `src/routes/support.js` и `src/routes/adminSupport.js`.

## Requirements

### Requirement: Обращения пользователя

`GET /api/me/support`, `POST /api/me/support` и `POST /api/me/support/:id/replies` MUST требовать Bearer. Пользователь видит и дополняет только свои тикеты. Ответ пользователя сохраняется с автором `USER`.

#### Scenario: Список без сессии

- GIVEN Bearer отсутствует
- WHEN клиент вызывает `GET /api/me/support`
- THEN статус 401

### Requirement: Очередь админки

При Basic Auth система SHALL давать `GET /api/admin/support`, `GET /api/admin/support/:id`, `PATCH /api/admin/support/:id`, `POST /:id/replies` и `POST /:id/notes`. Ответ пользователю виден в переписке. Заметка (`notes`) остаётся внутренней.

#### Scenario: Смена статуса

- GIVEN администратор авторизован и тикет существует
- WHEN он вызывает `PATCH /api/admin/support/:id` со статусом из `SupportTicketStatus`
- THEN тикет сохраняет этот статус

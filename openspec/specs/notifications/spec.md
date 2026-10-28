# Уведомления и push

## Purpose

Лента уведомлений пользователя, регистрация push-токенов и кампании админки. Источники: `ecosystem.js`, `pushTokens.js`, `adminPushCampaigns.js`. Доставка в сокет описана в домене `social`: сервер шлёт события тому же соединению `/api/ws/chats`.

## Requirements

### Requirement: Лента уведомлений

`GET /api/me/notifications`, `PATCH /api/me/notifications/:id/read` и `POST /api/me/notifications/read-all` MUST требовать Bearer. Прочитать можно только своё уведомление. `read-all` помечает прочитанными уведомления текущего пользователя.

#### Scenario: Чужая отметка прочитанным

- GIVEN уведомление принадлежит другому пользователю
- WHEN текущий пользователь вызывает `PATCH /api/me/notifications/:id/read`
- THEN статус 404, `error` равен `Notification not found`, и `readAt` чужого уведомления не меняется

### Requirement: Push-токены

`POST /api/me/push-tokens`, `DELETE /api/me/push-tokens/:id` и `DELETE /api/me/push-tokens` MUST требовать Bearer. Удаление коллекции снимает токены текущего пользователя.

#### Scenario: Регистрация без сессии

- GIVEN Bearer отсутствует
- WHEN клиент вызывает `POST /api/me/push-tokens`
- THEN статус 401 и токен не сохраняется

### Requirement: Кампании админки

При Basic Auth `/api/admin/push-campaigns` SHALL поддерживать список, создание, `GET /:id/preview`, `POST /:id/send` и CRUD шаблонов: `GET/POST /templates`, `PUT/DELETE /templates/:id`. Если FCM не настроен, отправка SHALL завершаться без падения процесса и со статусом пропуска, а не с неотловленным исключением.

#### Scenario: Список кампаний без входа

- GIVEN Basic Auth отсутствует
- WHEN клиент вызывает `GET /api/admin/push-campaigns`
- THEN статус 401

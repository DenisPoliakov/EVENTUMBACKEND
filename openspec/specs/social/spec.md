# Друзья и чаты

## Purpose

Поиск людей, дружба, личные чаты и websocket. Продукт (`FOOTBALL` или `CLUBS`) читается из заголовка `X-Eventum-Product`, query или body. Если значение не распознано, система отвечает 400 и текстом `product must be FOOTBALL or CLUBS`. По умолчанию продукт — `FOOTBALL`. Чаты тренера всегда относятся к `CLUBS`. Источники: `friends.js`, `chats.js`, `lib/product.js`, `lib/chatRealtime.js`.

## Requirements

### Requirement: Поиск и дружба

Следующие маршруты MUST требовать Bearer:

- `GET /api/users/search`
- `GET /api/me/friends`
- `GET /api/me/friends/requests`
- `GET /api/me/friends/outgoing`
- `POST /api/me/friends`
- `POST /api/me/friends/:friendshipId/accept`
- `POST /api/me/friends/:friendshipId/reject`
- `DELETE /api/me/friends/requests/:friendshipId`
- `DELETE /api/me/friends/:userId`

`POST /api/me/friends` без `userId` и без `username` SHALL давать 400. Успешное создание отвечает 201. Отмена заявки и удаление друга отвечают 204.

#### Scenario: Заявка без адресата

- GIVEN пользователь авторизован
- WHEN он вызывает `POST /api/me/friends` без `userId` и без `username`
- THEN статус 400 и `error` равен `userId is required`

### Requirement: Чаты

Все маршруты `/api/me/chats` MUST требовать Bearer. Система SHALL уметь открыть избранное (`POST /api/me/chats/saved`), прямой чат (`POST /api/me/chats/direct`) и чат с тренером (`POST /api/me/chats/coach-profile/:coachProfileId`). Сообщения: список, отправка, правка, удаление, отметка прочитанного, загрузка медиа (`POST .../media/upload` и `POST .../media`).

#### Scenario: Список чатов без токена

- GIVEN Bearer отсутствует
- WHEN клиент вызывает `GET /api/me/chats`
- THEN статус 401

### Requirement: Websocket чатов

Обновление соединения на путь `/api/ws/chats` SHALL принимать JWT из query `token`, подпротокола `bearer.<token>` или заголовка `Authorization: Bearer`. Неизвестный пользователь MUST получать 401 на upgrade. Активная блокировка MUST получать 403. Другой путь MUST получать 404. После успешного соединения сервер SHALL прислать сообщение `{ "type": "connected" }`. Неизвестный `type` клиентского сообщения SHALL получать `{ "type": "error", "code": "UNKNOWN_TYPE" }`. Поддерживаемые типы: `chat:subscribe`, `chat:message:send`, `chat:message:edit`, `chat:message:delete`, `chat:read`.

#### Scenario: Подключение без пользователя

- GIVEN токен не соответствует пользователю в базе
- WHEN клиент открывает websocket `/api/ws/chats`
- THEN upgrade завершается статусом 401

#### Scenario: Истечение access token

- GIVEN соединение уже открыто и срок `exp` токена наступил
- WHEN таймер сервера срабатывает
- THEN сервер закрывает сокет с кодом 4001

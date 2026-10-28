# Клубы, виды спорта и места

## Purpose

Публичный каталог клубов и видов спорта, избранные клубы пользователя, поиск мест и админский CRUD. Публичные маршруты — `src/routes/ecosystem.js` и `src/routes/sports.js` (админка). Клубы админки — `src/routes/clubs.js`.

## Requirements

### Requirement: Публичные клубы и виды спорта

`GET /api/sports`, `GET /api/clubs`, `GET /api/clubs/:id` и `GET /api/subscription-plans` SHALL быть доступны без токена. Неизвестный клуб MUST давать 404.

#### Scenario: Карточка клуба

- GIVEN клуб с таким `id` есть в базе
- WHEN клиент вызывает `GET /api/clubs/:id` без токена
- THEN статус 200 и тело описывает этот клуб

### Requirement: Поиск мест

`GET /api/search/places` SHALL проксировать поиск в Nominatim. Система MUST ограничивать частоту: не больше 20 запросов в минуту с одного ключа, иначе 429 и `error` о слишком частых запросах.

#### Scenario: Превышение лимита

- GIVEN с одного клиента уже отправлено 20 запросов за минуту
- WHEN приходит следующий `GET /api/search/places`
- THEN статус 429

### Requirement: Избранные клубы

`GET /api/me/favorite-clubs`, `POST /api/me/favorite-clubs` и `DELETE /api/me/favorite-clubs/:clubId` MUST требовать Bearer. Повторное добавление того же клуба MUST NOT создавать вторую связь.

#### Scenario: Избранное без токена

- GIVEN Authorization отсутствует
- WHEN клиент вызывает `GET /api/me/favorite-clubs`
- THEN статус 401

### Requirement: Админка клубов и спорта

При Basic Auth:

- `/api/admin/sports` — `GET`, `POST`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- `/api/admin/clubs` — те же методы

Удаление спорта с кодом из набора основных продуктов Eventum MUST отвечать 409 и `error`, равным `Core EVENTUM products cannot be deleted`. Неизвестный `id` MUST давать 404.

#### Scenario: Список клубов админки

- GIVEN администратор передал верный Basic Auth
- WHEN он вызывает `GET /api/admin/clubs`
- THEN статус 200

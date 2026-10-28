# Новости

## Purpose

Публичная лента, персональная лента, учёт просмотров и CRUD админки. Источники: `src/routes/public.js`, `src/routes/ecosystem.js`, `src/routes/news.js`, `src/lib/news.js`.

## Requirements

### Requirement: Публичная лента

`GET /api/news` SHALL быть доступен без токена. Параметр `limit` MUST быть целым от 1 до 100, иначе статус 400. Недопустимый `type` MUST давать 400 и `error`, равный `type is invalid`.

#### Scenario: Неверный limit

- GIVEN клиент передал `limit`, который не является целым от 1 до 100
- WHEN он вызывает `GET /api/news`
- THEN статус 400

### Requirement: Персональная лента

`GET /api/me/news` MUST требовать Bearer. Новости избранных клубов SHALL идти раньше остальных.

#### Scenario: Лента без сессии

- GIVEN Bearer отсутствует
- WHEN клиент вызывает `GET /api/me/news`
- THEN статус 401

### Requirement: Просмотры

`POST /api/me/news/:id/view` MUST требовать Bearer. Каждый вызов SHALL добавлять запись `NewsView` и увеличивать `viewCount`. `uniqueViewerCount` SHALL расти только при первом просмотре этого пользователя за счёт `NewsUniqueView`. Ответ содержит `newsId`, `viewCount`, `uniqueViewerCount` и `isFirstViewByUser`.

#### Scenario: Повторный просмотр новости

- GIVEN пользователь уже открывал эту новость
- WHEN он снова вызывает `POST /api/me/news/:id/view`
- THEN `viewCount` увеличивается, а `uniqueViewerCount` остаётся прежним
- AND `isFirstViewByUser` равен false

### Requirement: Админка

При Basic Auth `/api/admin/news` SHALL поддерживать `GET`, `POST`, `PUT /:id`, `POST /:id/image` и `DELETE /:id`.

#### Scenario: Список новостей админки

- GIVEN администратор авторизован
- WHEN он вызывает `GET /api/admin/news`
- THEN статус 200

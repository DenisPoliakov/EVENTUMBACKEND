# Карточки игроков

## Purpose

Публичный каталог игроков и карточка текущего пользователя. Маршруты подключены из `src/routes/playerCards.js` через `public.js` с префиксом `/api`.

## Requirements

### Requirement: Справочник опций

`GET /api/player-card-options` SHALL отвечать без токена и отдаёт допустимые значения полей карточки.

#### Scenario: Анонимный запрос опций

- GIVEN клиент не авторизован
- WHEN он вызывает `GET /api/player-card-options`
- THEN статус 200

### Requirement: Каталог игроков

`GET /api/players` и `GET /api/players/:userId` SHALL работать без токена. Если передан действующий Bearer, система MAY учитывать его как optional auth и отдавать поля с учётом приватности и дружбы. Недействительный Bearer MUST NOT превращать публичный запрос в 401.

#### Scenario: Список без токена

- GIVEN в базе есть карточки
- WHEN клиент вызывает `GET /api/players` без Authorization
- THEN статус 200

### Requirement: Своя карточка

`GET /api/me/player-card`, `PUT /api/me/player-card` и `POST /api/me/player-card/avatar` MUST требовать Bearer. Аватар без файла SHALL отклоняться.

#### Scenario: Сохранение без сессии

- GIVEN Bearer отсутствует
- WHEN клиент вызывает `PUT /api/me/player-card`
- THEN статус 401

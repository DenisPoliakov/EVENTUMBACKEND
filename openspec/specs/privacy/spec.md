# Приватность профиля

## Purpose

Настройки видимости профиля текущего пользователя. Источник: `GET /api/me/privacy` и `PATCH /api/me/privacy` в `src/routes/auth.js`. Оба маршрута требуют Bearer.

## Requirements

### Requirement: Чтение настроек

Авторизованный пользователь SHALL получать свои флаги приватности, включая `hideBirthDate`, `hideCity` и `hideCoachContacts`.

#### Scenario: Чтение своих настроек

- GIVEN у пользователя есть действующий access token
- WHEN он вызывает `GET /api/me/privacy`
- THEN статус 200 и тело содержит его флаги приватности

#### Scenario: Чужой запрос без токена

- GIVEN заголовок Bearer отсутствует
- WHEN клиент вызывает `GET /api/me/privacy`
- THEN статус 401

### Requirement: Изменение настроек

`PATCH /api/me/privacy` SHALL обновлять только настройки владельца токена.

#### Scenario: Обновление флага города

- GIVEN пользователь авторизован
- WHEN он отправляет `PATCH /api/me/privacy` с новым `hideCity`
- THEN последующий `GET /api/me/privacy` возвращает сохранённое значение

# Сводка экосистемы

## Purpose

Один авторизованный агрегат для клиента: активные абонементы, истекающие подписки и связанные счётчики. Маршрут `GET /api/ecosystem` в `src/routes/ecosystem.js`. Остальные маршруты того файла разложены по доменам `clubs`, `news`, `notifications` и `commerce`.

## Requirements

### Requirement: Персональная сводка

`GET /api/ecosystem` MUST требовать Bearer. Ответ SHALL относиться только к пользователю из токена. Активной считается подписка со статусом `ACTIVE` и `expiresAt` в будущем.

#### Scenario: Сводка без токена

- GIVEN Authorization отсутствует
- WHEN клиент вызывает `GET /api/ecosystem`
- THEN статус 401

#### Scenario: Чужая сводка не отдаётся

- GIVEN в базе есть подписки другого пользователя
- WHEN текущий пользователь вызывает `GET /api/ecosystem`
- THEN в ответе нет абонементов, у которых `userId` отличается от `sub` токена

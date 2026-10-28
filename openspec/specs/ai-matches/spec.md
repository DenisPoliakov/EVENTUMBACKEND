# История ИИ-матчей

## Purpose

Личная история матчей, которые клиент сохраняет после ИИ-разбора. Маршруты в `src/routes/aiMatchHistory.js`. Все требуют Bearer.

## Requirements

### Requirement: Список и запись

`GET /api/me/ai-matches` SHALL возвращать историю текущего пользователя. `POST /api/me/ai-matches` SHALL сохранять новую запись этому пользователю. Чужие записи в список не попадают.

#### Scenario: Список без сессии

- GIVEN Bearer отсутствует
- WHEN клиент вызывает `GET /api/me/ai-matches`
- THEN статус 401

### Requirement: Удаление своей записи

`DELETE /api/me/ai-matches/:id` SHALL удалять запись, только если она принадлежит пользователю токена.

#### Scenario: Чужая запись

- GIVEN запись с этим `id` принадлежит другому пользователю
- WHEN текущий пользователь вызывает `DELETE /api/me/ai-matches/:id`
- THEN статус 404, `error` равен `AI match history item not found`, и запись владельца остаётся в базе

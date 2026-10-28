# Тренировки

## Purpose

Программы тренировок, шаги, уникальные просмотры, сессии пользователя и аналитика админки. Источники: `workoutProgramsPublic.js`, `workoutPrograms.js`, `workoutSessions.js`, `adminWorkoutAnalytics.js`.

## Requirements

### Requirement: Публичный каталог программ

`GET /api/workout-programs`, `GET /api/workout-programs/:id` и `GET /api/workout-programs/:id/steps` SHALL отдавать только публично доступные программы. Авторизация необязательна. Для действующего Bearer `viewedByMe` SHALL показывать, смотрел ли пользователь программу. Неизвестная программа MUST давать 404 и `error` равный `Workout program not found`.

#### Scenario: Неизвестная программа

- GIVEN программы с таким `id` нет среди публичных
- WHEN клиент вызывает `GET /api/workout-programs/:id`
- THEN статус 404

### Requirement: Уникальный просмотр программы

`POST /api/me/workout-programs/:id/view` MUST требовать Bearer. Первая фиксация создаёт `WorkoutProgramView` и возвращает `isFirstViewByUser` равным true вместе с `programId` и `uniqueViewerCount`. Повтор MUST NOT увеличивать число уникальных зрителей.

#### Scenario: Повторный просмотр

- GIVEN пользователь уже смотрел программу
- WHEN он снова вызывает `POST /api/me/workout-programs/:id/view`
- THEN `isFirstViewByUser` равен false и `uniqueViewerCount` не увеличивается

### Requirement: Сессии пользователя

`GET /api/me/workout-sessions` и `POST /api/me/workout-sessions` MUST требовать Bearer. Повтор с тем же клиентским ключом SHALL возвращать уже сохранённую сессию со статусом 200, а не вторую запись; первая вставка отвечает 201. `POST /api/me/workout-sessions/bulk` SHALL принимать массив `sessions` длиной от 1 до 500. Неизвестный `programId` MUST давать 400.

#### Scenario: Пустой пакет

- GIVEN пользователь авторизован
- WHEN он вызывает `POST /api/me/workout-sessions/bulk` с пустым массивом или без массива `sessions`
- THEN статус 400

### Requirement: Админские программы и шаги

При Basic Auth `/api/admin/workout-programs` SHALL поддерживать список, создание, чтение, обновление, удаление, шаги (`GET/POST /:id/steps`, `GET/PUT/DELETE /:id/steps/:stepId`), `PUT /:id/steps/reorder` и `POST /:id/steps/:stepId/illustration`. Иллюстрация без файла MUST давать 400.

#### Scenario: Иллюстрация без файла

- GIVEN администратор авторизован
- WHEN он вызывает `POST /api/admin/workout-programs/:id/steps/:stepId/illustration` без файла
- THEN статус 400 и `error` равен `No file uploaded`

### Requirement: Аналитика

`GET /api/admin/workout-analytics` MUST требовать Basic Auth и SHALL возвращать счётчики по программам, включая название программы, если она ещё есть в каталоге.

#### Scenario: Аналитика без входа

- GIVEN Basic Auth отсутствует
- WHEN клиент вызывает `GET /api/admin/workout-analytics`
- THEN статус 401

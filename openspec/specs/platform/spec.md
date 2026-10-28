# Платформа API

## Purpose

Общие свойства HTTP API Eventum: живость, документация, формат ошибок, ограничение размера тела и доступ в админские маршруты. Поведение задают `PLAYGOADMIN/backend/src/app.js`, `src/config.js` и `src/routes/public.js`.

## Requirements

### Requirement: Ответ для неизвестного пути

Система SHALL отвечать на неизвестный путь статусом 404 и JSON с полем `error`, равным `Not found`. Заголовок `X-Powered-By` MUST отсутствовать.

#### Scenario: Несуществующий путь

- GIVEN сервер принимает HTTP-запрос
- WHEN клиент запрашивает путь, которого нет в контракте
- THEN статус ответа 404, тело равно `{ "error": "Not found" }`, заголовка `X-Powered-By` нет

### Requirement: Проверка живости

`GET /api/health` SHALL возвращать `status`, `database` и `timestamp`. При успешном запросе к PostgreSQL `database` равен `up` и статус 200. При ошибке запроса к базе статус MUST быть 503, а `database` — `down`.

#### Scenario: База доступна

- GIVEN PostgreSQL отвечает на `SELECT 1`
- WHEN клиент вызывает `GET /api/health`
- THEN статус 200 и `database` равен `up`

#### Scenario: База недоступна

- GIVEN запрос к базе завершается ошибкой
- WHEN клиент вызывает `GET /api/health`
- THEN статус 503 и `database` равен `down`

### Requirement: Документация OpenAPI

`GET /api/openapi.json` SHALL отдавать документ OpenAPI 3.0.3 с `info.title`, равным `EVENTUM API`. `GET /api/docs` SHALL открывать Swagger UI по этому документу.

#### Scenario: Сырой документ

- GIVEN процесс API запущен
- WHEN клиент вызывает `GET /api/openapi.json`
- THEN статус 200 и `info.title` равен `EVENTUM API`

### Requirement: Basic Auth админки

Каждый маршрут с префиксом `/api/admin` MUST требовать HTTP Basic. Без заголовка `Authorization: Basic` система SHALL отвечать 401, полем `error` равным `Auth required` и заголовком `WWW-Authenticate`. Неверная пара логин/пароль SHALL давать 401 и `error`, равный `Invalid credentials`. Учётные данные берутся из `ADMIN_USER` и `ADMIN_PASSWORD`.

#### Scenario: Запрос без учётных данных

- GIVEN клиент не передал Basic-заголовок
- WHEN клиент вызывает `GET /api/admin/cities`
- THEN статус 401 и `error` равен `Auth required`

### Requirement: Предел тела JSON

Система SHALL отклонять JSON крупнее `JSON_BODY_LIMIT` (по умолчанию `256kb`) статусом 413.

#### Scenario: Слишком большое тело входа

- GIVEN лимит тела оставлен по умолчанию
- WHEN клиент отправляет `POST /api/auth/login` с телом больше лимита
- THEN статус 413

### Requirement: Обязательные секреты в production

При `NODE_ENV=production` система MUST отказываться стартовать без `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD` и хотя бы одного корректного origin в `CORS_ORIGINS`. `JWT_SECRET` MUST быть не короче 32 символов, `ADMIN_PASSWORD` — не короче 12.

#### Scenario: Production без JWT_SECRET

- GIVEN `NODE_ENV` равен `production` и `JWT_SECRET` не задан
- WHEN процесс загружает `src/config.js`
- THEN загрузка завершается ошибкой с текстом `JWT_SECRET is required`

### Requirement: Загрузка файла админки

`POST /api/admin/uploads` SHALL принимать изображение и возвращать URL в каталоге `/uploads`. Файл больше 5 МБ MUST отклоняться со статусом 400.

#### Scenario: Файл больше лимита

- GIVEN администратор передал верный Basic Auth
- WHEN он отправляет изображение больше 5 МБ
- THEN статус 400 и `error` сообщает, что изображение не должно превышать 5 МБ

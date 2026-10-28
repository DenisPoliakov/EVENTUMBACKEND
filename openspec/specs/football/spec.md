# Футбол: города, стадионы, матчи и заявки

## Purpose

Публичный каталог футбола и его админский CRUD. Публичные чтения и подача заявки — `src/routes/public.js`. Админка — `cities.js`, `stadiums.js`, `matches.js`, `registrations.js`.

## Requirements

### Requirement: Публичный каталог

`GET /api/stadiums`, `GET /api/matches` и `GET /api/matches/:id` SHALL быть доступны без токена. `GET /api/news` описан в домене `news`. Неверный `limit` у публичных новостей не относится к этому домену.

#### Scenario: Список матчей без сессии

- GIVEN в базе есть матчи
- WHEN клиент вызывает `GET /api/matches` без Authorization
- THEN статус 200 и тело содержит список матчей

### Requirement: Публичная заявка на матч

`GET /api/registrations` и `POST /api/registrations` SHALL работать без Bearer. Пользователь с активной блокировкой платформы или активным запретом заявок MUST NOT получить одобренную заявку: система отклоняет такой запрос.

#### Scenario: Заявка заблокированного капитана

- GIVEN у капитана активна блокировка или `matchBanUntil` в будущем
- WHEN он вызывает `POST /api/registrations`
- THEN система не создаёт одобренную заявку и возвращает ошибку

### Requirement: Админский CRUD каталога

Под Basic Auth система SHALL давать:

- `/api/admin/cities` — `GET`, `POST`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- `/api/admin/stadiums` — те же методы
- `/api/admin/matches` — те же методы
- `/api/admin/registrations` — `GET`, `POST`, `PATCH /:id/status`, `DELETE /:id`

Создание стадиона и матча MAY публиковать новость типов `STADIUM_CREATED` и `MATCH_CREATED`.

#### Scenario: Смена статуса заявки

- GIVEN администратор авторизован и заявка существует
- WHEN он вызывает `PATCH /api/admin/registrations/:id/status`
- THEN статус заявки в базе становится переданным допустимым значением `RegistrationStatus`

### Requirement: Город уникален по имени

Имя города SHALL быть уникальным. Повторное создание того же имени MUST завершаться ошибкой, а не второй записью.

#### Scenario: Повтор города

- GIVEN город с таким `name` уже есть
- WHEN администратор вызывает `POST /api/admin/cities` с тем же именем
- THEN ответ ошибочный, вторая запись не создаётся

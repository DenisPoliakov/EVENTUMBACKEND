# Тренеры

## Purpose

Профиль тренера, фото и заявки на привязку к клубу. Пользовательские маршруты — `src/routes/coachProfiles.js`. Решение админки — `src/routes/adminCoachClubLinks.js`.

## Requirements

### Requirement: Профиль тренера

`GET /api/me/coach-profile` и `PUT /api/me/coach-profile` MUST требовать Bearer. `POST /api/me/coach-profile/photo` SHALL сохранять файл на диск и отвечать 201 с полем `url`. Этот маршрут сам не записывает `url` в профиль. Запрос без файла MUST давать 400 и `error`, равный `No file uploaded`.

#### Scenario: Фото без файла

- GIVEN пользователь авторизован
- WHEN он вызывает `POST /api/me/coach-profile/photo` без файла
- THEN статус 400

### Requirement: Заявка тренера на клуб

Тренер SHALL создавать заявку через `POST /api/me/coach-profile/club-link-requests`, видеть свои заявки через `GET /api/me/coach-profile/club-link-requests` и отменять ожидающую через `POST /api/me/coach-profile/club-link-requests/:id/cancel`. Новая заявка получает статус `PENDING`.

#### Scenario: Создание заявки

- GIVEN у пользователя есть профиль тренера и клуб существует
- WHEN он отправляет `POST /api/me/coach-profile/club-link-requests`
- THEN статус 201 и `request.status` равен `PENDING`

### Requirement: Решение админки

`GET /api/admin/coach-club-link-requests`, `POST /:id/approve` и `POST /:id/reject` MUST требовать Basic Auth. Одобрение переводит заявку в `APPROVED` и связывает тренера с клубом. Отклонение переводит её в `REJECTED`.

#### Scenario: Одобрение без прав админки

- GIVEN Basic Auth не передан
- WHEN клиент вызывает `POST /api/admin/coach-club-link-requests/:id/approve`
- THEN статус 401

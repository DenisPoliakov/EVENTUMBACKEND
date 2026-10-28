# Бронирования

## Purpose

Запись пользователя на тренировку и модерация статуса в админке. Источники: `src/routes/bookings.js` и `src/routes/adminBookings.js`.

## Requirements

### Requirement: Бронирования пользователя

`GET /api/me/bookings` и `POST /api/me/bookings` MUST требовать Bearer. Создание возвращает бронирование текущего пользователя.

#### Scenario: Список без сессии

- GIVEN Bearer отсутствует
- WHEN клиент вызывает `GET /api/me/bookings`
- THEN статус 401

### Requirement: Статус в админке

`GET /api/admin/bookings` и `PATCH /api/admin/bookings/:id/status` MUST требовать Basic Auth. Допустимые статусы — значения `TrainingBookingStatus`: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`. Подтверждение MAY создать уведомление пользователю.

#### Scenario: Подтверждение брони

- GIVEN администратор авторизован и бронь существует
- WHEN он вызывает `PATCH /api/admin/bookings/:id/status` со статусом `CONFIRMED`
- THEN бронь сохраняется со статусом `CONFIRMED`

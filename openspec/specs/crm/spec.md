# CRM

## Purpose

Сводный экран админки. Единственный маршрут домена — `GET /api/admin/crm/overview` в `src/routes/crm.js`.

## Requirements

### Requirement: Сводка

`GET /api/admin/crm/overview` MUST требовать Basic Auth и SHALL возвращать агрегированные показатели по пользователям, матчам, клубам и связанным сущностям, которые считает этот обработчик.

#### Scenario: Запрос без входа

- GIVEN Basic Auth отсутствует
- WHEN клиент вызывает `GET /api/admin/crm/overview`
- THEN статус 401

#### Scenario: Авторизованный обзор

- GIVEN администратор передал верные `ADMIN_USER` и `ADMIN_PASSWORD`
- WHEN он вызывает `GET /api/admin/crm/overview`
- THEN статус 200 и тело содержит сводку, а не список ошибок

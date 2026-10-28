# Коммерция

## Purpose

Заказы, оплата YooKassa, абонементы клубов, Premium приложения и рефералы. Источники: `orders.js`, `yookassaWebhook.js`, `premium.js`, `referrals.js`, `subscriptionPlans.js`, `subscriptions.js`, `adminOrders.js`, `adminPremium.js`, публичные планы в `ecosystem.js`.

## Requirements

### Requirement: Заказ пользователя

`POST /api/me/orders` MUST требовать Bearer. Цена SHALL вычисляться на сервере, а не приниматься из тела как источник истины. Заголовок `Idempotency-Key` SHALL возвращать уже созданный заказ при повторе того же ключа и того же запроса. Если YooKassa не настроена, система MUST не помечать заказ оплаченным и отвечает 503 с кодом ошибки провайдера.

#### Scenario: Повтор того же ключа идемпотентности

- GIVEN пользователь уже создал заказ с тем же `Idempotency-Key` и тем же телом
- WHEN он снова вызывает `POST /api/me/orders`
- THEN система не создаёт второй заказ и возвращает существующий

### Requirement: Прямая активация абонемента отключена

`POST /api/subscriptions` SHALL отвечать 410 и кодом `DIRECT_SUBSCRIPTIONS_DISABLED`. Маршрут всё равно MUST требовать Bearer.

#### Scenario: Прямая активация

- GIVEN пользователь авторизован
- WHEN он вызывает `POST /api/subscriptions`
- THEN статус 410 и `code` равен `DIRECT_SUBSCRIPTIONS_DISABLED`

### Requirement: Вебхук YooKassa

`POST /api/webhooks/yookassa` SHALL быть доступен без Bearer. Успешное уведомление активирует заказ только после проверки платежа у провайдера. Повтор того же успешного уведомления MUST быть безопасен и не применяет оплату второй раз.

#### Scenario: Повтор успешного вебхука

- GIVEN заказ уже переведён в `PAID` этим платежом
- WHEN провайдер присылает то же уведомление ещё раз
- THEN заказ остаётся оплаченным один раз

### Requirement: Premium и кредиты

`GET /api/me/premium`, `POST /api/me/premium`, `GET /api/me/premium/credits` и `POST /api/me/premium/credits/purchase` MUST требовать Bearer. Покупка без настроенной кассы SHALL не выдавать Premium.

#### Scenario: Premium без сессии

- GIVEN Bearer отсутствует
- WHEN клиент вызывает `GET /api/me/premium`
- THEN статус 401

### Requirement: Реферальный код

`GET /api/me/referral` SHALL отдавать код текущего пользователя, создавая его при отсутствии. `POST /api/me/referral/apply` SHALL применять чужой код один раз и MUST отклонять собственный код.

#### Scenario: Свой код

- GIVEN пользователь авторизован и знает свой код
- WHEN он вызывает `POST /api/me/referral/apply` с этим кодом
- THEN система не создаёт вознаграждение

### Requirement: Абонементы в админке

При Basic Auth система SHALL давать CRUD `/api/admin/subscription-plans` и чтение `/api/admin/subscriptions` плюс `PATCH /api/admin/subscriptions/:id/status`. `GET /api/admin/orders` и `GET /api/admin/premium` SHALL возвращать заказы и сводку Premium. Публичные `GET /api/subscription-plans` и `GET /api/me/subscriptions` описаны контрактом: первый без токена, второй с Bearer. `GET /api/me/subscriptions/notifications` тоже требует Bearer.

#### Scenario: Список заказов админки

- GIVEN администратор авторизован
- WHEN он вызывает `GET /api/admin/orders`
- THEN статус 200

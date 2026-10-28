# Веб-админка

## Purpose

Одностраничное приложение в `PLAYGOADMIN/admin`. Оно ходит в `/api/admin` с HTTP Basic и не содержит отдельной продуктовой логики заказов или матчей: состояние берётся из backend. Сборка — Vite, проверка типов — `tsc -b`.

## Requirements

### Requirement: Точка входа API

Клиент SHALL использовать `VITE_API_URL`, а если переменная пуста — `http://localhost:4000/api/admin`. Заголовок `Authorization` SHALL быть `Basic` от пары, которую оператор ввёл на экране входа.

#### Scenario: Локальный запуск без VITE_API_URL

- GIVEN переменная `VITE_API_URL` не задана
- WHEN админка выполняет запрос списка городов
- THEN запрос уходит на `http://localhost:4000/api/admin/cities`

### Requirement: Вход

Пока пара не проверена, приложение SHALL показывать страницу входа. Проверка — `GET /cities` с введёнными учётными данными. Успех сохраняет `admin_user` и `admin_pass` в `localStorage`. Ответ 401 на любом последующем запросе SHALL стирать эти ключи и возвращать на вход. Неверный пароль или недоступный сервер SHALL оставлять оператора на странице входа и показывать сообщение «Неверные учётные данные или сервер недоступен».

#### Scenario: Неверный пароль

- GIVEN backend отвечает 401 на `GET /api/admin/cities`
- WHEN оператор отправляет форму входа
- THEN сессия админки не открывается и показано сообщение об ошибке

### Requirement: Переключатель продукта

После входа оболочка SHALL переключать `FOOTBALL` и `CLUBS`. Выбор хранится в `localStorage` под ключом `admin_selected_product`. Для `FOOTBALL` боковое меню ведёт на стадионы, матчи, команды и заявки. Для `CLUBS` — на клубы, заявки тренеров, абонементы, оплаты, бронирования, wellness-истории, программы тренировок и аналитику тренировок. Общие пункты доступны в обоих продуктах: Premium, заказы YooKassa, CRM, города, пользователи, новости, push-кампании, поддержка. Если открыт маршрут чужого продукта, оболочка SHALL перейти на `/stadiums` или `/clubs`.

#### Scenario: Сохранённый продукт

- GIVEN в `localStorage` ключ `admin_selected_product` равен `FOOTBALL`
- WHEN оператор обновляет страницу уже войдя
- THEN активен сервис EVENTUM FOOTBALL и меню футбола

### Requirement: Экраны

Приложение SHALL регистрировать маршруты: `/cities`, `/stadiums`, `/matches`, `/users`, `/teams`, `/registrations`, `/news`, `/wellness-stories`, `/workout-programs`, `/workout-analytics`, `/push-campaigns`, `/support`, `/clubs`, `/coach-club-links`, `/subscription-plans`, `/subscriptions`, `/bookings`, `/orders`, `/premium`, `/crm`. Корень `/` SHALL перенаправлять на `/cities`. Путь `/cities` входит в общее меню и остаётся открытым для обоих продуктов.

#### Scenario: Корень приложения

- GIVEN оператор вошёл и выбран продукт `CLUBS`
- WHEN он открывает `/`
- THEN путь становится `/cities` и остаётся экраном городов

### Requirement: Слаг

Функция `slugify` SHALL транслитерировать русские буквы в латиницу, заменять прочие символы на дефис и ограничивать результат 80 символами. Пустой результат SHALL заменяться на `item`, если вызывающий код не передал другой fallback.

#### Scenario: Кириллический заголовок

- GIVEN строка `Привет мир`
- WHEN код вызывает `slugify`
- THEN результат равен `privet-mir`

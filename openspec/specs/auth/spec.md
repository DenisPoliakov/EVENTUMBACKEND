# Аутентификация и профиль

## Purpose

Регистрация, вход, обновление сессии и данные профиля пользователя. Источник: `PLAYGOADMIN/backend/src/routes/auth.js`. Ответы с токенами содержат `accessToken`, `refreshToken`, `expiresIn` и `user`.

## Requirements

### Requirement: Обязательные поля регистрации

`POST /api/auth/register` SHALL отвечать 400, если нет `email`, `username`, `password`, `city` или `birthDate`. `birthDate` MUST быть датой `YYYY-MM-DD`. `password` короче 6 символов MUST давать 400.

#### Scenario: Нет даты рождения

- GIVEN тело не содержит `birthDate`
- WHEN клиент вызывает `POST /api/auth/register`
- THEN статус 400 и `error` сообщает, что `birthDate` обязателен

#### Scenario: Короткий пароль

- GIVEN остальные обязательные поля заполнены, а длина `password` меньше 6
- WHEN клиент вызывает `POST /api/auth/register`
- THEN статус 400

### Requirement: Успешная регистрация

При валидных полях система SHALL создавать пользователя с ролью `USER`, город при необходимости и реферальный код. Ответ MUST иметь статус 201 и поля `accessToken` и `refreshToken`. Если передан недействительный `referralCode` или `inviteCode`, система SHALL удалить созданного пользователя и вернуть ошибку применения кода.

#### Scenario: Регистрация без реферального кода

- GIVEN email и username ещё не заняты, пароль не короче 6 символов, город и дата рождения заданы
- WHEN клиент вызывает `POST /api/auth/register`
- THEN статус 201, в теле есть `accessToken` и `refreshToken`, `referralBonus` равен `null`

### Requirement: Вход

`POST /api/auth/login` принимает `identifier` (email или username) и `password`. Пустые поля SHALL давать 400. Неверная пара SHALL давать 401 и `error`, равный `Unauthorized`. Активная блокировка пользователя SHALL давать 403. Успешный вход SHALL возвращать ту же форму токенов, что и регистрация.

#### Scenario: Неверный пароль

- GIVEN пользователь существует
- WHEN клиент передаёт верный identifier и неверный password
- THEN статус 401 и `error` равен `Unauthorized`

#### Scenario: Заблокированный пользователь

- GIVEN пароль верен и у пользователя активна блокировка
- WHEN клиент вызывает `POST /api/auth/login`
- THEN статус 403

### Requirement: Обновление и отзыв сессии

`POST /api/auth/refresh` с действующим `refreshToken` SHALL выдавать новую пару токенов. Недействительный токен MUST давать 401. `POST /api/auth/logout` SHALL отзывать переданный `refreshToken` и отвечать 204.

#### Scenario: Недействительный refresh

- GIVEN `refreshToken` неизвестен системе
- WHEN клиент вызывает `POST /api/auth/refresh`
- THEN статус 401 и `error` равен `Invalid refresh token`

### Requirement: Профиль по Bearer

`GET /api/me`, `PATCH /api/me` и `DELETE /api/me` MUST требовать `Authorization: Bearer`. Без токена или с недействительным токеном статус SHALL быть 401. Удаление существующего профиля SHALL отвечать 204.

#### Scenario: Профиль без токена

- GIVEN заголовок Authorization отсутствует
- WHEN клиент вызывает `GET /api/me`
- THEN статус 401 и `error` равен `Unauthorized`

### Requirement: Пароль и аватар

`POST /api/me/password/check` и `POST /api/me/password` SHALL быть доступны только владельцу токена. `POST /api/me/avatar` принимает файл, `DELETE /api/me/avatar` снимает аватар. Оба маршрута MUST требовать Bearer.

#### Scenario: Смена пароля без сессии

- GIVEN Bearer-токен не передан
- WHEN клиент вызывает `POST /api/me/password`
- THEN статус 401

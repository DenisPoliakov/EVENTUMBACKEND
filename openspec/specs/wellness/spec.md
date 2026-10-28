# Wellness-истории

## Purpose

Публичная лента историй, уникальные просмотры, свои истории тренера и CRUD админки. Источники: `wellnessStoriesPublic.js`, `wellnessStoriesMe.js`, `wellnessStories.js`, `src/lib/wellnessStories.js`.

## Requirements

### Requirement: Публичная лента

`GET /api/wellness-stories` и `GET /api/wellness-stories/:identifier` SHALL отдавать только активные уже опубликованные истории (`isActive`, `publishedAt` не в будущем, без мягкого удаления). Авторизация необязательна. Для действующего Bearer поле `viewedByMe` SHALL отражать, есть ли строка `WellnessStoryView` этой пары story/user. Идентификатор MAY быть `id` или `slug`.

#### Scenario: Скрытая история не попадает в ленту

- GIVEN история с `isActive` равным false либо с `publishedAt` в будущем
- WHEN клиент вызывает `GET /api/wellness-stories`
- THEN этой истории в списке нет

#### Scenario: Неизвестная история

- GIVEN нет публичной истории с таким id или slug
- WHEN клиент вызывает `GET /api/wellness-stories/:identifier`
- THEN статус 404 и `error` равен `Wellness story not found`

### Requirement: Уникальный просмотр

`POST /api/me/wellness-stories/:identifier/view` MUST требовать Bearer. Первая фиксация пользователя SHALL создавать `WellnessStoryView` и возвращать `isFirstViewByUser` равным true. Повтор того же пользователя MUST NOT увеличивать `uniqueViewerCount` и SHALL возвращать `isFirstViewByUser` равным false. Уникальность пары задана ограничением `(storyId, userId)`.

#### Scenario: Повторный просмотр

- GIVEN пользователь уже зафиксировал просмотр этой истории
- WHEN он снова вызывает `POST /api/me/wellness-stories/:identifier/view`
- THEN `uniqueViewerCount` не растёт и `isFirstViewByUser` равен false

#### Scenario: Гость не фиксирует просмотр

- GIVEN Bearer отсутствует
- WHEN клиент вызывает `POST /api/me/wellness-stories/:identifier/view`
- THEN статус 401 и запись просмотра не создаётся

### Requirement: Истории тренера

`GET/POST /api/me/wellness-stories`, `PUT/DELETE /api/me/wellness-stories/:id` и `POST /api/me/wellness-stories/:id/cover` MUST требовать Bearer. Публикация SHALL быть доступна только пользователю с профилем тренера и активным Premium: иначе статус 403 и `error` равен `Coach profile is required to publish stories` либо `Active Premium subscription is required to publish stories`. Менять и удалять SHALL быть можно только свою историю. Удаление — мягкое. Обложка без файла MUST давать 400.

#### Scenario: Чужая история

- GIVEN история принадлежит другому автору
- WHEN пользователь вызывает `DELETE /api/me/wellness-stories/:id`
- THEN статус 404 и история не помечается удалённой

### Requirement: Админский CRUD

При Basic Auth `/api/admin/wellness-stories` SHALL поддерживать список, `POST /import`, чтение, создание, обновление, удаление и `POST /:id/cover`. В списке админке доступен уникальный счётчик просмотров.

#### Scenario: Создание истории

- GIVEN администратор авторизован и slug свободен
- WHEN он вызывает `POST /api/admin/wellness-stories` с обязательными полями
- THEN статус 201 и история получает переданные `slug`, `title`, `body` и `category`

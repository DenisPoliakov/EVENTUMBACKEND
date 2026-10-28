# Участие в разработке EVENTUMBACKEND

## Куда попадает код

1. Ветка работы ответвляется от `sdd-devel`.
2. Pull request открывается в `sdd-devel`.
3. В `main` изменения попадают только pull request-ом из `sdd-devel`.
4. Такой pull request мёржит человек. Агентам мёржить и пушить в `main` запрещено.
5. Если pull request в `main` открыт из другой ветки, проверка `Protect main` завершается ошибкой.

Прямой push в `main` нужно запретить в настройках GitHub (branch protection). Файл workflow сам по себе не заменяет эту настройку: его нужно отметить обязательной проверкой.

## Spec-Driven Development

Поведение API и админки описано в `openspec/specs`. Индекс доменов — `openspec/specs/README.md`.

Общий контракт с приложением `otwtz/eventum_clubs`:

`openspec/contracts/eventum-api.contract.json`

Файл в двух репозиториях должен совпадать. Соседний репозиторий подключён как OpenSpec `references` (`eventum-clubs`) в `openspec/config.yaml`. Локальный `store` не используется: свои `specs/` и `changes/` важнее внешнего корня.

Изменение поведения:

1. Change в `openspec/changes/<id>/` с дельтой `ADDED` / `MODIFIED` / `REMOVED`.
2. Реализация.
3. Обновление as-is спеки и, если меняются маршруты, контракта.
4. Архивация change в `openspec/changes/archive/`.

## Язык спек

Русский текст. Не переводятся ключевые слова `SHALL`, `MUST`, `SHOULD`, `Requirement`, `Scenario`, `WHEN`, `THEN`, `GIVEN`, `ADDED`, `MODIFIED`, `REMOVED`, имена полей, идентификаторы и код.

## Проверки

Backend (`PLAYGOADMIN/backend`):

- `npm run lint` — синтаксис и `prisma validate`
- `npm run test:unit` — модульные и контрактные тесты, база не нужна
- `npm run test:integration` — нужна PostgreSQL и переменная `TEST_DATABASE_URL`

Админка (`PLAYGOADMIN/admin`):

- `npm run lint`
- `npm test`
- `npm run build`

В GitHub Actions интеграционные тесты идут с сервисом `postgres:16`. `TEST_DATABASE_URL` указывает на эту базу, поэтому тесты выполняются, а не пропускаются.

## Секреты

Не коммитьте файлы `.env`, пароли, JWT, ключи YooKassa и Firebase. Для локальной разработки копируйте `PLAYGOADMIN/backend/.env.example`.

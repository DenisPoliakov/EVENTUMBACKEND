# Агенты Eventum Backend

Этот репозиторий — backend и админка Eventum (`PLAYGOADMIN/backend`, `PLAYGOADMIN/admin`). Мобильное приложение живёт в соседнем репозитории `otwtz/eventum_clubs`.

## Ветки

- Интеграционная ветка: `sdd-devel`.
- Защищённая ветка: `main`.
- Агентам запрещено пушить в `main` и мёржить в `main`.
- В `main` изменения попадают только через pull request из `sdd-devel`, который смёржил человек.
- Pull request с этой работой открывается в `sdd-devel`, не в `main`.
- Workflow `Protect main` падает, если pull request в `main` открыт не из `sdd-devel`.

## OpenSpec

- As-is спеки: `openspec/specs/<домен>/spec.md`. Индекс: `openspec/specs/README.md`.
- Настройки: `openspec/config.yaml`. Мультирепо-манифест: `openspec/workspace.yaml`.
- Ссылка на приложение (`references`, не `store`): репозиторий `eventum-clubs`.
- Общий контракт API: `openspec/contracts/eventum-api.contract.json`. Он должен совпадать с копией в приложении.
- Новое поведение планируется в `openspec/changes/<id>/` и только потом переносится в as-is спеку.
- Продуктовую логику не менять, пока change этого явно не требует. Спеки подгоняются под код, а не код под устаревший снимок.

## Язык

Текст артефактов — на русском. На английском остаются только ключевые слова формата (`SHALL`, `MUST`, `SHOULD`, `Requirement`, `Scenario`, `WHEN`, `THEN`, `GIVEN`, `ADDED`, `MODIFIED`, `REMOVED`), имена полей, идентификаторы и код.

## Секреты

Не коммитить `.env`, ключи, пароли и токены. В CI интеграционные тесты получают `TEST_DATABASE_URL` от сервиса PostgreSQL, а не из секретов репозитория.

## Проверки

Из `PLAYGOADMIN/backend`: `npm run lint`, `npm run test:unit`, при заданном `TEST_DATABASE_URL` — `npm run test:integration`.

Из `PLAYGOADMIN/admin`: `npm run lint`, `npm test`, `npm run build`.

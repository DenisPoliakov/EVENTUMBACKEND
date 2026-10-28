# Индекс доменов

As-is спеки описывают код на ветке `sdd-devel`. Маршруты сверены с `PLAYGOADMIN/backend/src`. Контракт маршрутов: `openspec/contracts/eventum-api.contract.json`.

Снимок `transfer/EVENTUMBACKEND` из `otwtz/eventum_clubs` этому репозиторию был недоступен (приватный репозиторий вне установки GitHub App). Спеки ниже сняты с текущего кода, а не скопированы из того снимка.

| Домен | Спека | О чём |
| --- | --- | --- |
| `platform` | [spec.md](platform/spec.md) | Живость, OpenAPI, ошибки, Basic Auth админки, загрузки |
| `auth` | [spec.md](auth/spec.md) | Регистрация, сессия, профиль, пароль, аватар |
| `privacy` | [spec.md](privacy/spec.md) | Видимость профиля |
| `users` | [spec.md](users/spec.md) | Пользователи в админке и модерация |
| `football` | [spec.md](football/spec.md) | Города, стадионы, матчи, заявки |
| `teams` | [spec.md](teams/spec.md) | Команды капитана и админский CRUD |
| `player-cards` | [spec.md](player-cards/spec.md) | Карточки игроков |
| `clubs` | [spec.md](clubs/spec.md) | Клубы, виды спорта, избранное, поиск мест |
| `coaches` | [spec.md](coaches/spec.md) | Профиль тренера и заявки на клуб |
| `bookings` | [spec.md](bookings/spec.md) | Бронирования тренировок |
| `commerce` | [spec.md](commerce/spec.md) | Заказы, YooKassa, абонементы, Premium, рефералы |
| `wellness` | [spec.md](wellness/spec.md) | Wellness-истории и уникальные просмотры |
| `workouts` | [spec.md](workouts/spec.md) | Программы, шаги, сессии, аналитика |
| `news` | [spec.md](news/spec.md) | Новости и просмотры |
| `social` | [spec.md](social/spec.md) | Друзья, чаты, websocket |
| `notifications` | [spec.md](notifications/spec.md) | Уведомления, push-токены и кампании |
| `support` | [spec.md](support/spec.md) | Обращения в поддержку |
| `crm` | [spec.md](crm/spec.md) | Сводка CRM |
| `ecosystem` | [spec.md](ecosystem/spec.md) | Персональная сводка `GET /api/ecosystem` |
| `ai-matches` | [spec.md](ai-matches/spec.md) | История ИИ-матчей |
| `admin` | [spec.md](admin/spec.md) | Веб-админка |

Продукт чатов и друзей задаётся заголовком `X-Eventum-Product`: `FOOTBALL` или `CLUBS`. Если заголовок не передан, система выбирает `FOOTBALL`.

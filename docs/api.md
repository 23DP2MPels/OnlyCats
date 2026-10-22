# HTTP API

Префикс `/api`. JSON-запросы, кроме multipart для изображения.
Сессия — cookie `onlycats_session`, браузер передаёт `credentials: include`.
Описание маршрутов Swagger доступно по `/api/docs`, JSON — `/api/docs-json`.
Схемы входных данных определены в `backend/src/dto.ts`.

| Метод  | Маршрут                          | Доступ / назначение                                           |
| ------ | -------------------------------- | ------------------------------------------------------------- |
| GET    | /health                          | Состояние БД и настройки Sandbox                              |
| POST   | /auth/register                   | email, name, password (10–72 символа, не более 72 UTF-8 байт) |
| POST   | /auth/login                      | email, password; устанавливает cookie                         |
| POST   | /auth/logout                     | Удаляет cookie                                                |
| GET    | /auth/me                         | Публичные данные текущего пользователя или null               |
| GET    | /cats?search=                    | Каталог, до 100 котов                                         |
| GET    | /cats/:id                        | Профиль и признаки isOwner/subscribed                         |
| POST   | /cats                            | Сессия; name, breed, bio, необязательный avatar               |
| PATCH  | /cats/:id                        | Владелец/ADMIN; те же поля целиком                            |
| GET    | /cats/:id/posts                  | До 100 публикаций; приватные поля скрываются                  |
| POST   | /cats/:id/posts                  | Владелец/ADMIN; title, body, isPrivate                        |
| PATCH  | /posts/:id                       | Владелец/ADMIN; title, body, isPrivate                        |
| DELETE | /posts/:id                       | Владелец/ADMIN; удаляет публикацию и фото                     |
| POST   | /posts/:id/image                 | Владелец/ADMIN; multipart file, до 8 МБ                       |
| GET    | /posts/:id/image                 | Права проверяются на каждый запрос                            |
| GET    | /account                         | Сессия; свои коты и подписки                                  |
| POST   | /subscriptions                   | Сессия; catId; возвращает approvalUrl                         |
| POST   | /subscriptions/confirm/:paypalId | Подтверждение своей подписки через PayPal                     |
| POST   | /subscriptions/:id/sync          | Получить актуальное состояние своей подписки                  |
| DELETE | /subscriptions/:id               | Отмена своей подписки                                         |
| POST   | /payments/paypal/webhook         | Проверенная подпись PayPal, повторная доставка допустима      |
| GET    | /admin/users                     | Только ADMIN; без хешей паролей                               |

Ошибки: 400 — неверные данные, 401 — нет сессии, 403 — нет прав,
404 — объект не найден, 409 — email занят, 413 — превышен размер файла,
503 — Sandbox не настроен или недоступен. Текст ошибки — поле `message`.

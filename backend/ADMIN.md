# Панель команды

## URL (не в публичном меню, `noindex`)

| Страница | Кто | Что |
|----------|-----|-----|
| **`/staff`** | manager, admin | Хаб: вход и ссылки |
| **`/staff/manager`** | manager, admin | Только **модерация объявлений** (без секрета) |
| **`/staff/admin`** | только **admin** | **Пользователи и роли**, **разделы и категории** — после ввода **секрета операций** |

## Права API

- `GET/PATCH /admin/listings*` — JWT с ролью **manager** или **admin**.
- `GET /admin/users`, `PATCH /admin/users/{id}/role`, `GET /admin/ops/ping`, **`/admin/catalog/*`** — только **admin** + заголовок **`X-Devor-Ops-Secret`** = `DEVOR_OPS_SECRET`.

### Каталог (admin + секрет)

- `GET /admin/catalog/sections` — список разделов.
- `POST /admin/catalog/sections` — создать раздел (`key`, `name_ru`, `name_tj`, `slug`).
- `GET /admin/catalog/categories?section_key=services` — плоский список категорий раздела.
- `POST /admin/catalog/categories` — подраздел (`section_key`, `name_ru`, `name_tj`, `slug`, опционально `parent_id`).
- `PATCH /admin/catalog/categories/{id}` — правка названий и slug.
- `DELETE /admin/catalog/categories/{id}` — удаление, если нет детей и объявлений.

## Секрет и демо-учётки

- Переменная **`DEVOR_OPS_SECRET`** на backend (локально по умолчанию см. `routers/admin.py`).
- Демо: **`admin` / `admin`**, **`manager` / `manager_devor_change_me`** — смените в продакшене.

Выполните миграции (в т.ч. enum `manager`).

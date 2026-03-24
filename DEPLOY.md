# Развёртывание Devor (MVP)

## Локально через Docker Compose

1. Скопируйте переменные: `cp .env.example .env` и при необходимости отредактируйте.
2. Запуск БД, API и фронта:

В каталоге с `docker-compose.yml` (имя папки может быть любым — в файле задано `name: devor`, чтобы не было ошибки «project name must not be empty»):

```bash
cd "Без названия"
docker compose up -d db backend frontend
```

3. Примените миграции Alembic (схема эскроу, отзывы, Telegram и т.д.):

```bash
docker compose exec backend sh -c "pip install -r requirements.txt && alembic upgrade head"
```

Либо без Docker, из каталога `backend/` с установленным Python 3.12:

```bash
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/devor
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

4. API: [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger/OpenAPI).  
5. Фронт: [http://localhost:3000](http://localhost:3000), сценарий MVP: [http://localhost:3000/mvp](http://localhost:3000/mvp).

## Telegram-бот

1. Создайте бота в Telegram через [@BotFather](https://t.me/BotFather), получите `TELEGRAM_BOT_TOKEN`.
2. Укажите `TELEGRAM_BOT_USERNAME` (имя без `@`).
3. Запустите сервис бота (профиль `telegram`):

```bash
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_BOT_USERNAME=YourBotName
docker compose --profile telegram up -d telegram
```

Бот обрабатывает `/start <token>` для привязки аккаунта (токен выдаётся API `POST /integrations/telegram/link-request`).

## VPS (обзор)

- Установите Docker и Docker Compose.
- Пробросьте reverse-proxy (Caddy/Nginx) на `frontend:3000` и `backend:8000`, либо один домен с путём `/api` к backend.
- Задайте сильные `JWT_SECRET`, `DEVOR_OPS_SECRET`, отключите `DEVOR_DEMO_TOPUP` в продакшене.
- Включите HTTPS; для JWT в заголовке `Authorization` CSRF не требуется; при переходе на cookie-сессии добавьте CSRF-токены.

## Безопасность (MVP)

- Пароли пользователей хешируются (bcrypt).
- Заголовки `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` выставляются middleware.
- Валидация входных данных — Pydantic на всех телах запросов.
- XSS: React/Next экранирует вывод; не используйте `dangerouslySetInnerHTML` с пользовательским HTML.

## SEO / SSG

Страницы категорий и объявлений подгружают данные с API **на клиенте**; для прод-SEO при необходимости можно вернуть серверный рендер или ISR — см. документацию Next.js.

## Сервер (VPS / Docker)

1. **Обычная сборка фронта:** `cd frontend && npm ci && npm run build && npm run start` (порт 3000). Динамические маршруты (`/listings/[id]`, `/categories/[slug]`) работают через `getStaticPaths` с `fallback: blocking` без перечисления всех ID в билде.
2. **Reverse proxy** (Caddy/Nginx) — прокси на `http://127.0.0.1:3000`.
3. **Регистр имён** (Linux): пути и импорты — как в репозитории.

## GitHub Pages (статический экспорт)

1. Сборка: `cd frontend && npm run build:static` — папка `frontend/out` с `index.html` и `basePath` `/devor` для адреса `https://<user>.github.io/devor/`.
2. Деплой: workflow `.github/workflows/deploy-github-pages.yml` (после первого запуска в настройках репозитория **Settings → Pages** выберите источник **GitHub Actions**).
3. На статическом хостинге перечислены ID объявлений до `NEXT_EXPORT_LISTING_ID_MAX` (по умолчанию 1200) плюс демо-ID из mock; остальные пути могут отдать 404 до перехода на сервер с Node.

## Ошибка «index.html» на GitHub Pages

Если видите 404 от GitHub Pages, убедитесь, что опубликована папка **`out`** после `npm run build:static`, а не сырой репозиторий без сборки.

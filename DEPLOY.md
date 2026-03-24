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

Страница категории `pages/categories/[slug].js` использует SSR; для ISR переведите на `getStaticProps` с `revalidate` или на App Router с `revalidate` в `fetch` — см. документацию Next.js.

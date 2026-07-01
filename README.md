# Y.Map / Real Holat

Гражданская платформа мониторинга и прозрачности инфраструктуры для Узбекистана. Жители сообщают о фактическом состоянии социальных объектов, аналитика и программы видны публично, а органы управления получают срез реальной картины (Стратегия «Узбекистан - 2030»).

Прод: `map.ytech.space`
Репозиторий: `https://gitlab.ytech.space/others/ymap.git`

## Стек

- Фронтенд: Nuxt 4 (Vue 3, Pinia, @nuxtjs/i18n RU/UZ, Tailwind, Leaflet). Каталог `frontend-nuxt/`.
- Бэкенд: Node.js (ESM) + Express, MongoDB (Mongoose), Redis. Каталог `backend/`.
- Бот: Grammy (Telegram). Каталог `bot/`.
- Инфраструктура: Docker Compose + Nginx.
- ИИ: Google Gemini (анализ обращений на стороне бэка).

## Структура репозитория

```
ymap/
  backend/         # Express API (MongoDB, Redis, JWT)
  bot/             # Telegram-бот (Grammy)
  frontend/        # старый фронт на React 19 + Vite (заменён на frontend-nuxt)
  frontend-nuxt/   # актуальный фронт на Nuxt 4
  docker-compose.yml
  .env.sample
```

Миграция фронта: `frontend/` (React) заменён на `frontend-nuxt/` (Nuxt). Старый каталог оставлен для истории.

## Требования

- Node.js 20+ и npm.
- MongoDB и Redis (либо через Docker).
- Docker + Docker Compose - для контейнерного запуска.

## Быстрый старт (Docker Compose)

1. Скопируйте пример окружения:

```
cp .env.sample .env
```

2. Заполните переменные (см. раздел «Переменные окружения»): как минимум `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `BOT_EMAIL`, `BOT_PASSWORD`.

3. Поднимите сервисы:

```
docker compose up -d --build
```

Сервисы: `frontend`, `backend` (порт 4000), `bot`, `redis` (порт 7791).

Замечание по деплою фронта: в текущем `docker-compose.yml` сервис `frontend` собирается из `./frontend` (старый React). Для деплоя Nuxt переведите сборку фронта на `./frontend-nuxt` (обновите `context` и `Dockerfile` сервиса `frontend`). В рамках миграции сам `docker-compose.yml` не менялся.

## Локальная разработка

Бэкенд:

```
cd backend
npm install
npm run dev        # nodemon, порт из BACKEND_PORT (по умолчанию 4000)
npm run seed       # опционально: наполнение БД
```

Фронтенд (Nuxt):

```
cd frontend-nuxt
npm install
npm run dev        # http://localhost:3000
```

`NUXT_PUBLIC_API_BASE` по умолчанию `/api` (один origin за Nginx). При отдельном запуске задайте базовый URL бэка либо проксируйте `/api` на Express.

Проверки Nuxt:

```
npm run typecheck
npm run build
```

## Переменные окружения

Бэкенд (`backend/`):

| Переменная | Назначение |
|---|---|
| `NODE_ENV` | режим (`production` / `development`) |
| `BACKEND_PORT` | порт API (по умолчанию 4000) |
| `MONGODB_URI` | строка подключения MongoDB |
| `REDIS_URL` | строка подключения Redis |
| `JWT_SECRET` | секрет JWT |
| `JWT_EXPIRES_IN` | срок жизни токена (по умолчанию 7d) |
| `CORS_ORIGIN` | разрешённый origin (по умолчанию `*`) |
| `UPLOADS_DIR` | каталог загрузок (в Docker `/app/uploads`) |
| `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`, `ADMIN_NAME` | параметры сид-админа |
| `GEMINI_API_KEY` | ключ Google Gemini |

Бот (`bot/`):

| Переменная | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `GEMINI_API_KEY` | ключ Google Gemini |
| `YMAP_API_URL` | базовый URL API (в Docker `http://backend:4000/api`) |
| `BOT_EMAIL`, `BOT_PASSWORD` | сервисный аккаунт бота |

Фронтенд (`frontend-nuxt/`, все секреты только на сервере):

| Переменная | Назначение |
|---|---|
| `NUXT_PUBLIC_API_BASE` | базовый URL API, виден клиенту (по умолчанию `/api`) |
| `NUXT_INTERNAL_API_BASE` | абсолютный URL Express для SSR-запросов |
| `NUXT_DASHBOARD_API_URL`, `NUXT_DASHBOARD_API_KEY` | Дашборд Агентства (Этап 9) |
| `NUXT_DOPPIX_API_URL`, `NUXT_DOPPIX_API_KEY` | Doppix |

Docker Compose (`.env`): `PROJECT_NAME`, `FRONTEND_EXPOSE`, `FRONTEND_PROD_PORT`, `BACKEND_EXPOSE`, `REDIS_PORT`, `REDIS_EXPOSE`.

## Состояние проекта

Готово:

- Миграция фронта на Nuxt: профиль, лидерборд, аналитика (4 вкладки), единая карта, лендинг.
- Backend Этап 10 (доступная часть): аналитика/регионы/районы/маркеры сделаны публичными, админ-роут закомментирован, веб-создание обращений и AI-эндпоинт отключены, массовое назначение задач убрано.
- Гейтинг: лендинг/аналитика/карта/контент публичны, логин нужен только для профиля и лидерборда.

Подробный отчёт с этапами и блокерами: `ymap-rework-progress-and-blockers.md`.

Важно перед деплоем:

- Публичные без логина: `/api/analytics`, `/api/regions`, `/api/districts`, `/api/markers`.
- Отключены: `POST /api/issues` (веб-подача обращений), `POST /api/ai/analyze`, роут `/api/admin`. Отключённое сохранено в коде в виде комментариев (обратимо).
- Отключение `POST /api/issues` и `POST /api/ai/analyze` ломает текущий сценарий Telegram-бота (`/report` -> анализ -> создание обращения). Выкатывать только скоординированно с запуском Doppix.

## Блокеры (внешние команды и модули)

- Дашборд Агентства (Фарход Оманов) - источник данных по программам, аналитике и объектам. Контракт API не получен.
- Doppix - Telegram-app для приёма обращений и геймификации. Контракт не получен, координация через Наримана.
- Нариман - контент разделов «Просто о сложном» и «Истории людей».

## Команда

- Разработка: Bobur, Malik.
- Внешние интеграции: Фарход Оманов (Дашборд), Doppix (Telegram-app), Нариман (контент).

## Лицензия

См. файл `LICENSE`.
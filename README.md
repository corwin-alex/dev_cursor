# Трекер обучения и прогресса по курсам

Fullstack-приложение: каталог курсов, модулей и уроков, прогресс по уроку и заметки на уровне курса, модуля и урока.

**Стек:** React, React Router, Webpack, SCSS; Node.js, Express; SQLite.

## Локальный запуск

1. Установка зависимостей:

```bash
npm install
```

2. Сборка клиента:

```bash
npm run build
```

3. Запуск сервера:

```bash
npm start
```

Приложение: `http://localhost:3000` (порт задаётся переменной `PORT`, по умолчанию 3000).

База по умолчанию: файл `data/learning-tracker.db` (каталог создаётся автоматически).

## Поведение данных

- Прогресс урока: фиксированные шаги 0 %, 25 %, 50 %, 75 %, 100 %.
- Заметки: списки строк для курса, модуля и урока (в API и БД хранятся как JSON-массив).

## API

Аутентификация (сессия по Bearer-токену в заголовке `Authorization`):

- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — вход
- `POST /api/auth/logout` — выход
- `GET /api/auth/me` — текущий пользователь (нужен токен)

Каталог и сущности:

- `GET /api/catalog` — курсы пользователя с модулями и уроками
- `POST /api/courses` — создать курс (`title`, `description`, опционально `notes`)
- `POST /api/modules` — создать модуль (`courseId`, `title`, опционально `notes`)
- `POST /api/lessons` — создать урок (`moduleId`, `title`)
- `PUT /api/lessons/:id` — обновить урок: `title`, `progress` (0–100, на сервере приводится к 0/25/50/75/100), `notes` (массив строк)
- `PUT /api/courses/:id/notes` — заметки курса (массив строк)
- `PUT /api/modules/:id/notes` — заметки модуля (массив строк)
- `DELETE /api/courses/:id`, `DELETE /api/modules/:id`, `DELETE /api/lessons/:id`

Служебное: `GET /api/health`.

## Деплой на Render

- **Build:** `npm install && npm run build`
- **Start:** `npm start`
- Переменные: `NODE_ENV=production`, при демо с очисткой данных при рестарте можно задать `DATABASE_PATH=:memory:`.

Для постоянного хранения SQLite на Render нужен persistent disk или внешняя БД; при `:memory:` данные теряются при перезапуске инстанса.

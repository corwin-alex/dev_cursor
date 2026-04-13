# Трекер обучения и прогресса по курсам

Простое fullstack-приложение, где пользователь ведет каталог:

- Курсы
- Модули курсов
- Уроки модулей
- Прогресс (0-100) и заметки по каждому уроку

Стек:

- Frontend: HTML, SCSS, JavaScript, React, React Router, Webpack
- Backend: Node.js, Express.js
- DB: SQLite

## Локальный запуск

1. Установите зависимости:

```bash
npm install
```

2. Соберите клиент:

```bash
npm run build
```

3. Запустите сервер:

```bash
npm start
```

Приложение откроется на `http://localhost:3000`.

## API

- `GET /api/catalog` - полный каталог (курсы, модули, уроки)
- `POST /api/courses` - создать курс
- `POST /api/modules` - создать модуль
- `POST /api/lessons` - создать урок
- `PUT /api/lessons/:id` - обновить урок (title/progress/notes)
- `DELETE /api/courses/:id`
- `DELETE /api/modules/:id`
- `DELETE /api/lessons/:id`

## Деплой на Render

### 1) Создайте Web Service

- Runtime: `Node`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

### 2) Настройте переменные окружения

- `NODE_ENV=production`
- `DATABASE_PATH=/var/data/learning-tracker.db`

### 3) Подключите Persistent Disk

Для SQLite важно хранить файл БД на постоянном диске:

- Mount Path: `/var/data`
- Size: минимум 1 GB

### 4) Проверка

- После деплоя откройте URL сервиса.
- Создайте курс, модуль, урок.
- Перезапустите сервис и проверьте, что данные сохранились.

## Рекомендации для Render

- Использовать один сервис (Express отдает и API, и собранный фронтенд).
- Не хранить SQLite в корне проекта (`/opt/render/project/src`), потому что это не постоянное хранилище.
- Делать бэкапы файла базы с Persistent Disk по расписанию.

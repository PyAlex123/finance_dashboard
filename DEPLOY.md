# Развёртывание (Фаза 5) — Docker + Telegram Web App

Прод-сборка одним `docker compose`: **MySQL 8 + FastAPI + nginx(SPA)**, опционально
**Caddy** для HTTPS. Вход — обычный (по имени) или через **Telegram**.

> ⚠️ Имя папки проекта содержит кириллицу, из-за чего Docker не может вывести имя
> проекта. Поэтому во всех командах указывается `-p finreports`.

---

## 1. Быстрый старт (HTTP, локально или в сети)

```bash
cp .env.docker.example .env.docker      # при желании поправьте пароли/порт
docker compose -p finreports --env-file .env.docker up -d --build
```

Открыть: **http://localhost:8080** (порт задаётся `WEB_PORT`).

Что поднимется:
- `db` — MySQL 8 (данные в томе `db_data`, переживают перезапуск);
- `api` — FastAPI; при старте применяет миграции Alembic и слушает `:8000` внутри сети;
- `web` — nginx: раздаёт собранный фронт и проксирует `/api` на `api`
  (фронт и API на одном origin — CORS не нужен).

Остановить: `docker compose -p finreports down` (данные останутся; `-v` удалит и тома).

Логи: `docker compose -p finreports logs -f api`

---

## 2. HTTPS через Caddy (нужен домен)

Caddy сам получает и продлевает сертификат Let's Encrypt. Требуется реальный
домен, указывающий A/AAAA-записью на сервер, и открытые порты 80/443.

В `.env.docker`:
```
DOMAIN=finance.example.com
```
Запуск с профилем `tls`:
```bash
docker compose -p finreports --env-file .env.docker --profile tls up -d --build
```
Сайт будет на `https://finance.example.com` (Caddy проксирует на `web`).

---

## 3. Вход через Telegram Web App

Приложение работает и без Telegram (обычный вход по имени). Чтобы включить вход
через Telegram:

1. У [@BotFather](https://t.me/BotFather) создайте бота → получите **токен**.
2. Задайте боту Web App URL (кнопка меню):
   `/setmenubutton` (или через `/newapp`) → укажите публичный `https://`-адрес
   сайта (из шага 2 — Telegram требует HTTPS).
3. В `.env.docker`:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC...            # токен от BotFather
   JWT_SECRET=<длинная случайная строка>       # обязательно смените
   ```
4. Перезапустите: `docker compose -p finreports --env-file .env.docker --profile tls up -d --build`.

Как это работает:
- фронт внутри Telegram берёт подписанный `initData` и шлёт на `POST /api/auth/telegram`;
- бэкенд проверяет подпись (HMAC-SHA256 с токеном бота) и выдаёт **свой JWT**;
- запросы к данным идут с `Authorization: Bearer <JWT>`; пространство пользователя —
  `tg:<telegram-id>`, доступ к чужому пространству отклоняется (401/403);
- вне Telegram и при пустом `TELEGRAM_BOT_TOKEN` — прежний открытый режим по имени.

---

## 4. Переменные (.env.docker)

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `WEB_PORT` | HTTP-порт сайта | `8080` |
| `VITE_API_URL` | база API для сборки фронта (`/` = тот же origin) | `/` |
| `DB_PASSWORD` / `DB_ROOT_PASSWORD` | пароли MySQL | `finpass` / `rootpass` |
| `CORS_ORIGINS` | разрешённые источники API | `*` |
| `TELEGRAM_BOT_TOKEN` | токен бота (пусто = вход через Telegram выкл.) | — |
| `JWT_SECRET` | секрет подписи JWT | `change-me-in-production` |
| `DOMAIN` | домен для Caddy/TLS | `localhost` |

Файл `.env.docker` в `.gitignore` — секреты не попадают в репозиторий.

---

## 5. Обновление и обслуживание

- Обновить после изменений кода: повторить `up -d --build`.
- Миграции БД: применяются автоматически при старте `api` (`alembic upgrade head`).
- Бэкап MySQL:
  ```bash
  docker compose -p finreports exec db mysqldump -ufin -p"$DB_PASSWORD" fin_reports > backup.sql
  ```

---

## Связанные документы
- `RUNNING.md` — запуск в dev-режиме и доступ в одной Wi-Fi сети (без Docker).
- `server/README.md` — API-эндпоинты и запуск бэкенда напрямую.
- `ARCHITECTURE.md` — фазы и принципы (Фаза 5 — этот документ).

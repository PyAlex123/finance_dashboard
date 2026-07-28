# Развёртывание как Telegram Web App на подпути

Один контейнер: **FastAPI отдаёт собранный фронт + API + SQLite**. Ставится на подпуть
существующего домена (напр. `https://grammerce.io/dashboards`), за уже работающим
**nginx** с TLS. Вход — через Telegram (у каждого своя учётка по Telegram id).

```
Telegram → кнопка меню → https://<домен>/dashboards/
  nginx (TLS)  location /dashboards/ → 127.0.0.1:8090
    контейнер app (FastAPI):
      /dashboards/          → SPA (StaticFiles)
      /dashboards/api/...   → API (snapshot, auth/telegram, health)
      SQLite: /data/fin_reports.db (том app_data)
```
Подпуть согласован end-to-end: `BASE_PATH`/`VITE_BASE`/`VITE_API_URL`. Префикс в nginx
**не срезается** (`proxy_pass` без завершающего `/`).

---

## 1. Репозиторий → сервер

```bash
# на сервере
sudo mkdir -p /opt/grammerce-dashboards && sudo chown $USER: /opt/grammerce-dashboards
cd /opt/grammerce-dashboards
git clone <repo-url> .
cp .env.docker.example .env.docker
```

Заполнить `.env.docker` (см. таблицу ниже). Минимум — `TELEGRAM_BOT_TOKEN` и
`JWT_SECRET` (`openssl rand -hex 32`). Файл в `.gitignore` — секреты не в репозитории.

## 2. Запуск контейнера

```bash
docker compose -p grammerce --env-file .env.docker up -d --build
docker compose -p grammerce logs -f app      # логи
curl -s http://127.0.0.1:8090/dashboards/api/health   # {"status":"ok",...}
```

Контейнер слушает `127.0.0.1:8090` (наружу закрыт — проксирует nginx).

## 3. nginx: маршрут /dashboards

В `/etc/nginx/sites-available/<домен>`, внутри блока `server { listen 443 ssl; ... }`
добавить (существующий `location /` не трогать):

```nginx
location = /dashboards { return 308 /dashboards/; }
location /dashboards/ {
    proxy_pass http://127.0.0.1:8090;   # без завершающего слэша — префикс /dashboards сохраняется
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
Применить: `sudo nginx -t && sudo systemctl reload nginx`.
Проверить: `curl -I https://<домен>/dashboards/` → 200.

## 4. Telegram-бот (@BotFather)

1. `/newbot` → имя и username → получить **токен** → в `.env.docker` (`TELEGRAM_BOT_TOKEN`),
   пересобрать: `docker compose -p grammerce --env-file .env.docker up -d --build`.
2. `/setdescription` — описание бота.
3. `/setmenubutton` → выбрать бота → текст «Открыть приложение» → URL
   `https://<домен>/dashboards/`. Одна кнопка, ведёт в Web App.

## 5. Проверка на реальном примере

- Открыть бота в Telegram → кнопка меню → грузится `…/dashboards`, вход автоматический.
- У пользователя своя учётка (`tg:<id>`, ник виден), данные сохраняются на сервере.
- Второй Telegram-аккаунт → отдельные данные. Проверить мобильную вёрстку и офлайн.

---

## Переменные `.env.docker`

| Переменная | Назначение | Пример |
|---|---|---|
| `BASE_PATH` | подпуть на бэкенде | `/dashboards` |
| `VITE_BASE` | база ассетов фронта (со слэшем) | `/dashboards/` |
| `VITE_API_URL` | база API на фронте | `/dashboards` |
| `APP_PORT` | локальный порт контейнера | `8090` |
| `DATABASE_URL` | SQLite в томе | `sqlite:////data/fin_reports.db` |
| `TELEGRAM_BOT_TOKEN` | токен бота (пусто = вход выкл.) | `123:ABC…` |
| `JWT_SECRET` | секрет JWT (сменить!) | `openssl rand -hex 32` |

## Обслуживание

- Обновление: `git pull && docker compose -p grammerce --env-file .env.docker up -d --build`.
- Бэкап данных (SQLite в томе):
  ```bash
  docker compose -p grammerce cp app:/data/fin_reports.db ./backup-$(date +%F).db
  ```
- Разместить на корне домена (без подпути): `BASE_PATH=`, `VITE_BASE=/`, `VITE_API_URL=/`
  и `location /` в nginx.

## На будущее (вне текущего объёма)
Бот-процесс (aiogram) для кнопки «Открыть с компьютера» и ссылки на вход — отдельный
сервис в этом же `docker-compose.yml`, использующий тот же `TELEGRAM_BOT_TOKEN`.

## Связанные документы
- `RUNNING.md` — dev-запуск и доступ в одной Wi-Fi сети (без Docker).
- `server/README.md` — API-эндпоинты и запуск бэкенда напрямую.

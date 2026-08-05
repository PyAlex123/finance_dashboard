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

## 0. ФАКТЫ ПРОД-СЕРВЕРА (grammerce.io) — не забывать

| Что | Значение |
|---|---|
| Домен / подпуть | `https://grammerce.io/dashboards/` |
| **Папка проекта на сервере** | **`/opt/finance_dashboard`** |
| Ветка, которую тянет сервер | `main` (`origin` = github.com/PyAlex123/finance_dashboard) |
| Порт контейнера (только localhost) | `127.0.0.1:8090` |
| Имя контейнера / проекта / образа | `finance-dashboard-app` / `finance-dashboard` / `finance-dashboard-app` |
| Reverse-proxy | nginx, конфиг `/etc/nginx/sites-available/grammerce.io` (`location /dashboards/`) |
| Бот | @financePro (кнопка меню Web App в @BotFather) |

**Обновить прод (стандартная последовательность):**
```bash
cd /opt/finance_dashboard
git pull origin main
docker compose --env-file .env.docker up -d --build     # из этой папки, БЕЗ -p
docker compose --env-file .env.docker logs -f app        # логи (Ctrl+C для выхода)
curl -s http://127.0.0.1:8090/dashboards/api/health      # {"status":"ok","telegramAuth":true}
```

**НЕЛЬЗЯ (иначе ломается ЧУЖОЙ сайт на этом же сервере):**
- не использовать флаг `-p` у `docker compose` (перебьёт имя проекта);
- не делать `docker compose down` на нашем проекте — только `up -d --build`;
- не трогать `/var/www/grammerce` и контейнеры `retail_saas_*` (это другой проект на :8005).

---

## 1. Репозиторий → сервер (первичная установка — уже сделано)

```bash
# на сервере (папка уже создана: /opt/finance_dashboard)
sudo mkdir -p /opt/finance_dashboard && sudo chown $USER: /opt/finance_dashboard
cd /opt/finance_dashboard
git clone <repo-url> .
cp .env.docker.example .env.docker
```

Заполнить `.env.docker` (см. таблицу ниже). Минимум — `TELEGRAM_BOT_TOKEN` и
`JWT_SECRET` (`openssl rand -hex 32`). Файл в `.gitignore` — секреты не в репозитории.

## 2. Запуск контейнера

```bash
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker logs -f app      # логи
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
   пересобрать: `docker compose --env-file .env.docker up -d --build`.
2. `/setdescription` — описание бота.
3. `/setmenubutton` → выбрать бота → текст «Открыть приложение» → URL
   `https://<домен>/dashboards/`. Одна кнопка, ведёт в Web App.

Больше у бота ничего настраивать не нужно: вход с сайта работает через него же —
кнопка «Войти через Telegram» открывает `t.me/<бот>?start=<код>`, бот показывает
кнопку подтверждения, вкладка в браузере входит сама. Имя бота сервер узнаёт
через `getMe`, `/setdomain` не требуется.

## 5. Вход через Google (Google Cloud)

Нужен, только если хотите включить кнопку «Войти через Google». Без `GOOGLE_CLIENT_ID`
кнопка неактивна, остальное работает.

1. [console.cloud.google.com](https://console.cloud.google.com) → **New project** → `finlo`.
2. **APIs & Services → OAuth consent screen** → тип **External** → название `finlo`,
   почта поддержки, домен `grammerce.io`, ссылки на политику и условия:
   `https://grammerce.io/dashboards/privacy` и `https://grammerce.io/dashboards/terms`
   (страницы уже опубликованы).
3. Scopes — только `openid`, `email`, `profile`. Это несенситивные скоупы,
   проверка приложения Google не требуется.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://grammerce.io`
     (для локальной отладки можно добавить `http://localhost:5173`);
   - Authorized redirect URIs — не нужны: используется ID-токен, а не redirect-поток.
5. Скопировать **Client ID** → `GOOGLE_CLIENT_ID=…` в `.env.docker` → пересобрать.
   Client secret на сервере не хранится и не нужен.

Проверка: `curl -s http://127.0.0.1:8090/dashboards/api/config` → `googleEnabled: true`.

## 6. Проверка на реальном примере

- Открыть бота в Telegram → кнопка меню → грузится `…/dashboards`, вход автоматический
  (лендинг внутри Telegram не показывается).
- У пользователя своя учётка (`tg:<id>`, ник виден), данные сохраняются на сервере.
- Второй Telegram-аккаунт → отдельные данные. Проверить мобильную вёрстку и офлайн.
- В браузере: `https://<домен>/dashboards/` — лендинг, `…/dashboards/login` →
  «Войти через Telegram» → открывается бот → кнопка «Войти с компьютера» → вкладка
  входит сама (код на странице и в сообщении должны совпасть). Прямые ссылки
  `…/login`, `…/privacy`, `…/terms`, `…/app` и F5 на них должны открываться
  (SPA-fallback на стороне FastAPI).
- Логи бота при этом: `docker compose --env-file .env.docker logs -f bot`.

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
| `TELEGRAM_BOT_USERNAME` | имя бота без «@»; обычно не нужна (берётся из `getMe`) | `financePro` |
| `GOOGLE_CLIENT_ID` | вход через Google (пусто = кнопка неактивна) | `123-abc.apps.googleusercontent.com` |
| `JWT_SECRET` | секрет JWT (сменить!) | `openssl rand -hex 32` |

## Данные пользователей и отчёты

- **Регистрация**: при каждом входе через Telegram запись пользователя создаётся/
  обновляется в таблице `users` (tg id, ник, имя, дата регистрации, последний вход).
  Профиль (фото + ник) показывается сверху — фото берётся свежим из Telegram каждой
  сессии (URL временные, в БД не храним).
- **Несколько отчётов**: у пользователя может быть несколько отчётов одного типа
  (ДДС, Баланс). Список — в таблице `reports`; тело каждого отчёта — обычный снимок в
  `snapshots` под ключом `tg:<id>:<form>:<rand>`. Переключение — сверху в модуле.
- Новые таблицы `users`/`reports` создаются автоматически (`create_all`) при первом
  старте после обновления — **миграции не нужны**, существующая `snapshots` не
  меняется.

## Обслуживание

- Обновление: `git pull && docker compose --env-file .env.docker up -d --build`.
- Бэкап данных (SQLite в томе):
  ```bash
  docker compose --env-file .env.docker cp app:/data/fin_reports.db ./backup-$(date +%F).db
  ```
- Разместить на корне домена (без подпути): `BASE_PATH=`, `VITE_BASE=/`, `VITE_API_URL=/`
  и `location /` в nginx.

## На будущее (вне текущего объёма)
Бот-процесс (aiogram) для кнопки «Открыть с компьютера» и ссылки на вход — отдельный
сервис в этом же `docker-compose.yml`, использующий тот же `TELEGRAM_BOT_TOKEN`.

## Связанные документы
- `RUNNING.md` — dev-запуск и доступ в одной Wi-Fi сети (без Docker).
- `server/README.md` — API-эндпоинты и запуск бэкенда напрямую.

# Развёртывание (сайт finlo.uz + Telegram Web App)

Один контейнер: **FastAPI отдаёт собранный фронт + API + SQLite**, за уже работающим
**nginx** с TLS. Основной адрес — корень домена `https://finlo.uz/`; тот же контейнер
раньше жил на подпути другого домена (`/dashboards`) — этот вариант тоже поддерживается.
Вход — через Telegram (Web App внутри мессенджера, через бота — в браузере) и Google.

```
Браузер → https://finlo.uz/            Telegram → кнопка меню → https://finlo.uz/
  nginx (TLS)  location / → 127.0.0.1:8090
    контейнер app (FastAPI):
      /            → SPA: лендинг, /login, /privacy, /terms, /app
      /api/...     → API (snapshot, auth/*, config, health)
      SQLite: /data/fin_reports.db (том app_data)
  контейнер bot: long-polling Telegram, подтверждает вход с сайта
```
Место размещения согласовано end-to-end: `BASE_PATH`/`VITE_BASE`/`VITE_API_URL`.
В корне это пусто / `/` / `/`; на подпути — `/dashboards`, `/dashboards/`, `/dashboards`.
`VITE_API_URL` пустым не бывает: пустое значение переводит фронт в локальный режим.

---

## 0. Устройство установки

| Что | Значение |
|---|---|
| Домен | `https://finlo.uz/` |
| Папка проекта на сервере | `/opt/finance_dashboard` |
| Ветка, которую тянет сервер | `main` |
| Порт контейнера (только localhost) | `127.0.0.1:8090` |
| Имя контейнера / проекта / образа | `finance-dashboard-app` / `finance-dashboard` / `finance-dashboard-app` |
| Reverse-proxy | nginx, `/etc/nginx/sites-available/finlo.uz` (`location /`) |

**Обновить прод (стандартная последовательность):**
```bash
cd /opt/finance_dashboard
git pull origin main
docker compose --env-file .env.docker up -d --build     # из этой папки, БЕЗ -p
docker compose --env-file .env.docker logs -f app        # логи (Ctrl+C для выхода)
curl -s http://127.0.0.1:8090/api/health                 # {"status":"ok","telegramAuth":true}
```
(на подпути health был `…:8090/dashboards/api/health` — путь повторяет `BASE_PATH`)

**Правила для сервера, где рядом живут другие сайты:**
- не использовать флаг `-p` у `docker compose` — он перебьёт имя проекта, и общий тег
  образа может затереть чужой стек;
- не делать `docker compose down` — только `up -d --build`;
- имена проекта, контейнеров и образа в `docker-compose.yml` зафиксированы уникальными
  именно ради изоляции от соседних compose-проектов.

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
curl -s http://127.0.0.1:8090/api/health              # {"status":"ok",...}
```

Контейнер слушает `127.0.0.1:8090` (наружу закрыт — проксирует nginx).

## 3. nginx: сайт finlo.uz (и переезд с /dashboards)

Сервер и IP те же — добавляется второй виртуальный хост. Готовые файлы лежат в
[deploy/nginx/](deploy/nginx/): `finlo.uz.conf` (сайт в корне домена) и
`legacy-subpath.conf` (редирект со старого подпути `/dashboards`).

**Порядок важен: сначала DNS, потом nginx на :80, потом сертификат, потом пересборка.**

1. **DNS у регистратора** (после регистрации домена): две A-записи —
   `@` и `www` на IP сервера. Проверить: `dig +short finlo.uz` → адрес сервера.
2. **Сайт на :80** (TLS ещё нет — блок только `listen 80`, иначе `nginx -t` упадёт):
   ```bash
   sudo cp /opt/finance_dashboard/deploy/nginx/finlo.uz.conf /etc/nginx/sites-available/finlo.uz
   sudo ln -s /etc/nginx/sites-available/finlo.uz /etc/nginx/sites-enabled/finlo.uz
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. **Сертификат** — certbot сам допишет TLS-секцию и редирект с http:
   ```bash
   sudo certbot --nginx -d finlo.uz -d www.finlo.uz
   ```
4. **Приложение в корень домена.** В `/opt/finance_dashboard/.env.docker`:
   ```ini
   BASE_PATH=
   VITE_BASE=/
   VITE_API_URL=/
   WEBAPP_URL=https://finlo.uz/
   ```
   (`VITE_API_URL` пустым не оставлять — это локальный режим без сервера!)
   Затем пересобрать: `docker compose --env-file .env.docker up -d --build`.
   Бот при старте сам переставит кнопку меню на новый URL.
5. **Старые ссылки.** В конфиге прежнего домена заменить два `location /dashboards…`
   на редирект (готовый вариант — в `deploy/nginx/legacy-subpath.conf`):
   ```nginx
   location = /dashboards { return 301 https://finlo.uz/; }
   location /dashboards/ { rewrite ^/dashboards/(.*)$ https://finlo.uz/$1 permanent; }
   ```
   `sudo nginx -t && sudo systemctl reload nginx`.

Проверка: `curl -I https://finlo.uz/` → 200, `curl -s https://finlo.uz/api/health` → `ok`,
старый адрес `…/dashboards/` → 301 на finlo.uz.

Данные пользователей при переезде не трогаются: они привязаны к `tg:<id>`/`g:<sub>`,
а не к адресу сайта.

## 4. Telegram-бот (@BotFather)

1. `/newbot` → имя и username → получить **токен** → в `.env.docker` (`TELEGRAM_BOT_TOKEN`),
   пересобрать: `docker compose --env-file .env.docker up -d --build`.
2. `/setdescription` — описание бота.
3. `/setmenubutton` → выбрать бота → текст «Открыть приложение» → URL
   `https://finlo.uz/`. Одна кнопка, ведёт в Web App. (Кнопку меню бот и сам
   переставляет при старте — из `WEBAPP_URL`.)

Больше у бота ничего настраивать не нужно: вход с сайта работает через него же —
кнопка «Войти через Telegram» ведёт в бота (`/start register`), бот присылает
одноразовую ссылку, переход по ней открывает кабинет уже залогиненным. Имя бота
сервер узнаёт через `getMe`, `/setdomain` не требуется.
Полная механика входа — в [AUTH.md](AUTH.md).

## 5. Вход через Google (Google Cloud)

Нужен, только если хотите включить кнопку «Войти через Google». Без `GOOGLE_CLIENT_ID`
кнопка неактивна, остальное работает.

1. [console.cloud.google.com](https://console.cloud.google.com) → **New project** → `finlo`.
2. **APIs & Services → OAuth consent screen** → тип **External** → название `finlo`,
   почта поддержки, домен `finlo.uz`, ссылки на политику и условия:
   `https://finlo.uz/privacy` и `https://finlo.uz/terms` (страницы уже опубликованы).
3. Scopes — только `openid`, `email`, `profile`. Это несенситивные скоупы,
   проверка приложения Google не требуется.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://finlo.uz` (и `https://www.finlo.uz`,
     если планируете вход с www; для локальной отладки — `http://localhost:5173`);
   - Authorized redirect URIs — не нужны: используется ID-токен, а не redirect-поток.
5. Скопировать **Client ID** → `GOOGLE_CLIENT_ID=…` в `.env.docker` → пересобрать.
   Client secret на сервере не хранится и не нужен.

Проверка: `curl -s http://127.0.0.1:8090/api/config` → `googleEnabled: true`.

## 6. Проверка на реальном примере

- Открыть бота в Telegram → кнопка меню → грузится `https://finlo.uz/`, вход
  автоматический (лендинг внутри Telegram не показывается).
- У пользователя своя учётка (`tg:<id>`, ник виден), данные сохраняются на сервере.
- Второй Telegram-аккаунт → отдельные данные. Проверить мобильную вёрстку и офлайн.
- В браузере: `https://finlo.uz/` — лендинг, `https://finlo.uz/login` →
  «Войти через Telegram» → открывается бот → кнопка со ссылкой → браузер возвращается
  уже в кабинет. F5 при этом не выкидывает: сессия лежит в `localStorage`. Прямые ссылки
  `/login`, `/privacy`, `/terms`, `/app` и F5 на них должны открываться
  (SPA-fallback на стороне FastAPI).
- Старый адрес `…/dashboards/` отвечает 301 на finlo.uz.
- Логи бота при этом: `docker compose --env-file .env.docker logs -f bot`.

---

## Переменные `.env.docker`

| Переменная | Назначение | Пример |
|---|---|---|
| `BASE_PATH` | подпуть на бэкенде (пусто = корень домена) | пусто |
| `VITE_BASE` | база ассетов фронта (со слэшем) | `/` |
| `VITE_API_URL` | база API на фронте (**пустым не оставлять!**) | `/` |
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

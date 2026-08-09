# Вход в finlo — фактическая механика

> Документ описывает **код, который есть**, а не план. Принятые решения и их
> обоснования — в §7.

---

## 0. Кто участвует

| Участник | Где живёт | Роль |
|---|---|---|
| API | FastAPI, [server/app/main.py](server/app/main.py) | выпускает и принимает токены входа, заводит пользователя, отдаёт JWT |
| Бот | контейнер `bot`, [server/app/bot.py](server/app/bot.py) | точка входа с компьютера: на `/start` присылает одноразовую ссылку |
| Фронт | [src/features/session/LoginScreen.tsx](src/features/session/LoginScreen.tsx), [src/Shell.tsx](src/Shell.tsx) | кнопки входа, приём токена, хранение сессии |

Бот один: он же точка входа и он же открывает кабинет как Web App.

---

## 1. Три пути входа

```
A. Telegram Mini App (бесшовный)
   Кнопка меню бота → Web App открывает сайт → initData → POST /api/auth/telegram → JWT

B. Ссылка из бота (вход с компьютера)
   Кнопка на сайте → GET /api/auth/telegram → 303 на t.me/<bot>?start=register
   → бот зовёт POST /api/auth/telegram/issue → одноразовая ссылка (5 мин)
   → клик → GET /api/auth/telegram/consume → 303 на /login#token=… → кабинет

C. Google
   Кнопка Identity Services → ID-токен → POST /api/auth/google → JWT
```

---

## 2. Путь A — Mini App

[main.py](server/app/main.py) `POST /api/auth/telegram`:
`validate_init_data` ([auth.py](server/app/auth.py)) — HMAC-SHA256 по схеме Telegram,
секрет `HMAC(key=b"WebAppData", msg=bot_token)`, строка из отсортированных `k=v` без
`hash`, плюс проверка возраста `auth_date` (`TELEGRAM_INITDATA_MAX_AGE`, по умолчанию
86400 с). Дальше `_issue_session` (§5). Эндпоинт не одноразовый — повторные входы
всегда работают, `auth_expired` тут невозможен.

`/setdomain` у @BotFather **не нужен**: initData отдаётся Web App'у и без него.

---

## 3. Путь B — ссылка из бота

### Шаг 1. Сайт отправляет в бота
`GET /api/auth/telegram` → `303` на `https://t.me/<bot>?start=register`.
Имя бота сервер узнаёт через `getMe` и кэширует ([providers.py](server/app/providers.py)),
переменная `TELEGRAM_BOT_USERNAME` нужна, только если контейнер не ходит в api.telegram.org.

### Шаг 2. Бот выпускает токен
На **каждый** `/start` (в т.ч. `/start register`) бот зовёт:

```
POST {INTERNAL_API_URL}/api/auth/telegram/issue
Authorization: Bearer <короткий JWT {"bot": true} на общем JWT_SECRET>
{ "telegram_id": "...", "first_name": ..., "last_name": ..., "username": ... }
```

Ответ: `{ token, consumeUrl, expiresIn, hasData }`. `hasData` определяет подпись кнопки
(«🚀 Открыть finlo» или «✅ Начать бесплатно»). Запись — `bot_auth_tokens`
([models.py](server/app/models.py)): `token`, `expires_at`, `used_at`, профиль tg.
TTL — `LOGIN_REQUEST_TTL`, по умолчанию 300 с. Протухшие чистятся при следующем выпуске.

Ссылка выпускается заново на каждый `/start` намеренно: она одноразовая, и старая
кнопка в истории чата обязана давать «устарела», а не пускать в чужую сессию.

### Шаг 3. Переход по ссылке = вход
`GET /api/auth/telegram/consume?token=…`:

- нет записи / уже использована (`used_at`) / истекла → `303` на `{BASE}/login?error=auth_expired`,
  фронт показывает «Ссылка для входа устарела. Войдите заново через Telegram.»;
- иначе `used_at = now`, `_issue_session`, `303` на `{BASE}/login#token=<jwt>&oauth=1`.

Токен едет **во фрагменте**: он не попадает ни в access-логи nginx, ни в `Referer`.

### Шаг 4. Фронт принимает токен
[Shell.tsx](src/Shell.tsx) при старте зовёт `takeTokenFromUrl()` ([routes.ts](src/routes.ts)) —
тот читает `#token=…` и тут же вычищает адрес через `history.replaceState`. Затем
`connectWithToken(token)` спрашивает `/api/auth/me` (это же и проверка токена) и уходит
в `/app`. Не принят — `/login?error=auth_expired`.

---

## 4. Путь C — Google

`POST /api/auth/google` с `credential` (ID-токен GIS). Подпись проверяет сам Google —
запросом к `https://oauth2.googleapis.com/tokeninfo`; мы сверяем `aud` (наш
`GOOGLE_CLIENT_ID`), издателя, срок и `email_verified` ([providers.py](server/app/providers.py)).
Пространство — `g:<sub>`.

---

## 5. Пользователь и сессия

`_issue_session` ([main.py](server/app/main.py)): upsert строки в `users` по ключу
пространства (`tg:<id>` или `g:<sub>`) и выдача **JWT** (HS256, ручная реализация в
[auth.py](server/app/auth.py), TTL `JWT_TTL_SECONDS` = 7 дней).

- Поиск пользователя — только по id провайдера. Синтетических email нет вовсе, поэтому
  подмена через «зарегистрируй синтетический email чужого id» здесь невозможна в принципе.
- Пространства `tg:*` и `g:*` закрыты `require_workspace_access`: токен обязан
  принадлежать владельцу пространства или его под-ключам отчётов.
- Фронт хранит `{token, workspace, name, photoUrl, isAdmin}` в `localStorage` под ключом
  **`finlo.session`** ([authSession.ts](src/features/session/authSession.ts)); при старте
  `restoreSession()` поднимает её и проверяет через `/api/auth/me`, на 401 — чистит.
- Админ — по `ADMIN_TG_IDS`; второго фактора для входа с компьютера пока нет
  (см. §7).

---

## 6. Переменные окружения

| Переменная | Зачем |
|---|---|
| `TELEGRAM_BOT_TOKEN` | подпись initData, вызовы Bot API; пусто — Telegram-вход выключен |
| `TELEGRAM_BOT_USERNAME` | необязательна: имя бота берётся из `getMe` |
| `JWT_SECRET` | подпись сессий **и** запросов бота к `issue` |
| `WEBAPP_URL` / `PUBLIC_URL` | origin для абсолютной ссылки `consumeUrl` |
| `INTERNAL_API_URL` | адрес API изнутри compose-сети (сервис `bot`) |
| `GOOGLE_CLIENT_ID` | вход через Google; пусто — кнопка неактивна |
| `LOGIN_REQUEST_TTL` | жизнь ссылки входа, по умолчанию 300 с |
| `ADMIN_TG_IDS` | кто видит список пользователей |

---

## 7. Принятые решения и почему

| Решение | Почему так |
|---|---|
| Запрос бота к `issue` подписан коротким JWT `{"bot": true}` на общем `JWT_SECRET`, а не отдельным shared-secret заголовком | секрет у обоих контейнеров уже общий; ещё одна переменная окружения — ещё одна возможность её забыть |
| Bearer возвращается во фрагменте (`/login#token=…`), а не в query | фрагмент не попадает ни в access-логи nginx, ни в заголовок `Referer` |
| Сессия — JWT, а не opaque-токен в Redis | состояние хранить не нужно, а вся установка — один контейнер с SQLite |
| Вход через бота вместо Telegram Login Widget | виджету нужен `/setdomain` у @BotFather и он не работает на произвольном домене без настройки |
| Второго фактора для админа пока нет | админ только читает список пользователей; вынесено в отдельную задачу |

---

## 8. Типовые сбои

| Симптом | Причина |
|---|---|
| `?error=auth_expired` | ссылка уже использована или старше 5 мин — частый случай: нажали старую кнопку в чате |
| Кнопка «Войти через Telegram» неактивна | сервер не отдал имя бота: пуст `TELEGRAM_BOT_TOKEN` либо контейнер не достучался до api.telegram.org |
| Внутри Telegram открывается лендинг | пустой `initData` — Web App открыт не кнопкой бота |
| 401 на `/api/auth/me` после обновления | сменился `JWT_SECRET` или истёк срок — фронт сам чистит `finlo.session` |
| Бот отвечает «Не удалось подготовить вход» | сервис `app` недоступен из контейнера `bot` (см. `INTERNAL_API_URL`) |

---

## 9. Тесты

```bash
cd server && PYTHONPATH=. ./.venv/Scripts/python.exe tests/test_auth.py   # и test_bot.py
npm test -- src/features/session src/Shell.test.tsx src/Shell.token.test.tsx
```

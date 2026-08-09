# Вход на платформу Grammerce через Telegram — полная механика

> Состояние на 06.08.2026, ветка `prepareToPTA`. Документ описывает **фактический код**, а не план.
> Старые файлы `md_s/tgauth.md` (черновик дизайна) и `md_s/BOT_AUTH_SPEC.md` (ТЗ для агента бота)
> — исторические; при расхождении верен этот документ.

---

## 0. Кто участвует

| Участник | Где живёт | Роль |
|---|---|---|
| Платформа (этот репозиторий) | FastAPI, `main.py` + `routers/auth.py` | выдаёт и потребляет токены входа, создаёт `User` + `Shop` |
| Маркетинг-бот `@Grammerce_bot` | токен `TELEGRAM_BOT_TOKEN` | точка входа: `/start register`, кнопки «Создать магазин» / «Открыть платформу» |
| Шоп-бот магазина | токен `BOT_TOKEN`, `bot/manager.py` | **к входу в кабинет отношения не имеет** (это витрина для покупателей) |
| Фронт логина | `public/login.html` + `public/js/auth.js` | ловит callback, делает WebApp-вход, кладёт Bearer в `localStorage` |
| Кабинет | `/cabinet` (React, `Cabinet_react_New`) и `/admin` (панель платформы) | читает Bearer из `localStorage.cabinet_bearer` |

Важно: в репозитории есть обработчик `/start register` в [bot/handlers/registration.py:300-344](../bot/handlers/registration.py#L300-L344) —
он написан на aiogram и выполняет роль маркет-бота. Продовый `@Grammerce_bot` — отдельный процесс,
но контракт у него ровно тот же (см. §3).

---

## 1. Три независимых пути входа через Telegram

```
A. Mini App (основной, бесшовный)
   Кнопка WebApp в боте → /login внутри Telegram → initData → POST /api/auth/telegram/webapp → Bearer → /cabinet

B. Deeplink в браузер (вход с компьютера)
   /start register → бот зовёт POST /api/auth/telegram/issue → consume_url (одноразовый, 5 мин)
   → пользователь открывает его в браузере → GET /api/auth/telegram/consume → Bearer → /login?token=… → /cabinet

C. Кнопка «Telegram» на форме логина сайта
   GET /api/auth/telegram → 303 на https://t.me/<bot>?start=register → дальше путь B (или A)
```

Плюс поверх B и A — **отдельная ветка для суперадмина платформы** (§5), с обязательным вторым фактором.

---

## 2. Путь A — Telegram Mini App (бесшовный вход)

### Фронт
[public/js/auth.js:47-129](../public/js/auth.js#L47-L129)

1. `DOMContentLoaded` на `/login`.
2. Сначала `handleOAuthCallback()` — если в URL уже есть `token`, обрабатываем его и выходим.
3. Если `window.Telegram.WebApp.initData` не пуст → `tryTelegramWebAppLogin()`:
   - `WebApp.ready()`, `WebApp.expand()`, показ лоадера «Входим…»;
   - `POST /api/auth/telegram/webapp` с телом `{ init_data }`;
   - при 200 → `finishOAuthLogin(token, shop_id, needs_setup, '1', is_superadmin)`;
   - при ошибке → лоадер снимается, показывается обычная форма логина (фолбэк).

### Бэкенд
[routers/auth.py:1221-1301](../routers/auth.py#L1221-L1301) — `POST /api/auth/telegram/webapp`

1. Требуется `TELEGRAM_BOT_TOKEN` (иначе 501).
2. `verify_telegram_web_app_data(init_data, bot_token)` — HMAC-SHA256 по схеме Telegram
   ([utils/telegram_auth.py:24-86](../utils/telegram_auth.py#L24-L86)): секрет = `HMAC(key=b"WebAppData", msg=bot_token)`,
   строка = отсортированные `k=v` через `\n` без поля `hash`. Плюс anti-replay по `auth_date`,
   TTL по умолчанию **86400 с** (`INIT_DATA_MAX_AGE_SECONDS`). Невалидно → 401.
3. `extract_user_data(init_data)` → `id`, `first_name`, `last_name`, `username`, `photo_url`, `language_code`.
4. Проверка на суперадмина (§5). Иначе:
5. `get_or_create_oauth_user(provider="telegram", provider_id=tg_id, email=f"tg_{tg_id}@telegram.user", …)`.
6. `generate_token()` → `store_token(bearer, {...})`, ответ:
   `{ token, shop_id, needs_setup, lang }` (+ `is_superadmin`, `redirect` для суперадмина).

**Ключевое свойство:** эндпоинт НЕ одноразовый и без своего TTL → повторные входы всегда работают,
ошибка `auth_expired` тут невозможна.

**Требование Telegram:** в @BotFather для `@Grammerce_bot` должен быть выполнен `/setdomain` на домен платформы,
иначе `initData` будет пустым и Mini App молча свалится в форму логина.

---

## 3. Путь B — deeplink `?start=register` → одноразовая ссылка

### Шаг 1. Бот получает `/start register`
[bot/handlers/registration.py:300-344](../bot/handlers/registration.py#L300-L344)

```python
POST {BACKEND_URL}/api/auth/telegram/issue
Headers: X-Bot-Secret: <PLATFORM_BOT_SHARED_SECRET>, Content-Type: application/json
Body: { "telegram_id": "...", "first_name": ..., "last_name": ..., "username": ... }
```
Опционально контракт принимает ещё `photo_url` и `lang` (`"ru"`/`"uz"`) — см. `TelegramAuthIssueRequest` в `schemas.py`.
Текущий handler их не шлёт; `lang` дефолтится в `"ru"`.

Бот показывает инлайн-кнопку с `consume_url`, подпись зависит от `has_shop`:
`"🚀 Открыть платформу"` если магазин есть, иначе `"✅ Создать магазин"`.

### Шаг 2. `POST /api/auth/telegram/issue`
[routers/auth.py:949-1012](../routers/auth.py#L949-L1012)

- Проверка `X-Bot-Secret` через `hmac.compare_digest` против `PLATFORM_BOT_SHARED_SECRET` (нет секрета в env → 501, не совпал → 401).
- Ленивая уборка записей старше `TTL + 1 день`.
- Создаётся строка в таблице `bot_auth_tokens` (миграции [031](../migrations/031_bot_auth_tokens.sql), [037](../migrations/037_bot_auth_token_lang.sql)):
  `token (uuid4)`, `telegram_id`, `tg_username`, `tg_first_name`, `tg_last_name`, `tg_photo_url`, `tg_lang`, `expires_at`, `used_at`.
- TTL = **5 минут** (`BOT_AUTH_TOKEN_TTL_MIN`).
- Считается `has_shop`: есть ли `User` с этим `telegram_id` и `Shop` с `owner_id = user.id`.
- Ответ: `{ token, consume_url, expires_at, has_shop, needs_setup }`,
  где `consume_url = {BACKEND_URL}/api/auth/telegram/consume?token=<uuid>`.

### Шаг 3. `GET /api/auth/telegram/consume?token=…`
[routers/auth.py:1106-1218](../routers/auth.py#L1106-L1218)

- Ищет запись; **невалиден / уже использован (`used_at`) / протух** → `303 → /login?error=auth_expired`
  (фронт показывает «Ссылка для входа устарела. Войдите заново через Telegram.», [auth.js:154-164](../public/js/auth.js#L154-L164)).
- Ставит `used_at = now` (строго одноразово).
- Если telegram_id принадлежит суперадмину → ветка §5, обычный логин НЕ выдаётся.
- Иначе `get_or_create_oauth_user(...)` → `generate_token()` → `store_token(...)`.
- Редирект `303` на:
  `/login?token=<bearer>&oauth=1&lang=<ru|uz>[&shop_id=N | &needs_setup=true]`.

### Шаг 4. Фронт принимает токен
`handleOAuthCallback()` в [public/js/auth.js:147+](../public/js/auth.js#L147) → `finishOAuthLogin()`
([auth.js:68-97](../public/js/auth.js#L68-L97)):

- `GrammerceAuth.setToken(token)` → `localStorage.cabinet_bearer` (легаси-ключ `authToken` мигрируется);
- `shopId` / `adminShopId` в `localStorage`, либо флаг `needs_shop_setup=true`;
- `window.location.replace('/cabinet?token=…&oauth=1…')` — именно `replace`, чтобы Bearer не оседал в истории;
- суперадмин (`is_superadmin`) уходит на `/admin`, а не в `/cabinet`.

---

## 4. Путь C — кнопка «Telegram» на сайте

[public/js/auth.js:588-590](../public/js/auth.js#L588-L590) → `window.location.href = '/api/auth/telegram'`
→ [routers/auth.py:922-934](../routers/auth.py#L922-L934) → `303` на `https://t.me/{TELEGRAM_BOT_USERNAME}?start=register`.
Без `TELEGRAM_BOT_USERNAME` — 501. Дальше всё как в §3.

Старый Telegram Login Widget **отключён намеренно** — единый флоу через бота.

---

## 5. Суперадмин платформы — отдельные правила

Кто такой суперадмин: [auth_utils.py:597-627](../auth_utils.py#L597-L627), `resolve_superadmin_by_telegram`.
Нужны **обе** проверки (fail-closed):
1. `tg_id` перечислен в env `SUPERADMIN_TELEGRAM_IDS`;
2. есть `PlatformUser` с этим `telegram_id`, `role='superadmin'`, `is_active=True`.

Смысл: компрометации одной только БД недостаточно — нужен ещё доступ к серверу и рестарт.

### 5.1 Через Mini App
Дополнительно требуется свежий `initData`: TTL ужат до **300 с** (`SUPERADMIN_INIT_DATA_MAX_AGE`),
иначе 401 «Данные входа устарели». Токен выдаётся через `issue_platform_token()`
([auth_utils.py:652-672](../auth_utils.py#L652-L672)) — в payload `platform_user_id`, `is_superadmin`,
`platform_role`, `pwd_v` (для инвалидации при смене пароля). Ответ содержит `redirect: "/admin"`.

### 5.2 Через consume-ссылку (вход с компьютера) — второй фактор
Так как `issue` доверяет только `X-Bot-Secret` и берёт `telegram_id` из тела, владелец секрета мог бы
выпустить ссылку на суперадминский id. Поэтому `consume` для суперадмина **не логинит**, а:

1. Генерирует `code`, кладёт `store_pending_desktop_login(code, {tg_id, confirmed:False, ip}, 60с)`
   (`SUPERADMIN_DESKTOP_CONFIRM_TTL`, Redis-first с in-memory фолбэком).
2. Шлёт в личный чат Telegram сообщение с IP и User-Agent и кнопкой
   `✅ Подтвердить вход` → `/api/auth/telegram/confirm-desktop?code=…`
   (через `services/platform_bot_notify.send_owner_telegram`). Не отправилось → вход отменён.
3. Браузеру отдаётся inline-страница `_desktop_confirm_page(..., poll=True)`
   ([auth.py:1015-1063](../routers/auth.py#L1015-L1063)): опрашивает
   `GET /api/auth/telegram/desktop-status?code=…` раз в 2 с, дедлайн 70 с.
4. Клик по кнопке в Telegram → `confirm-desktop` перепроверяет суперадмина и
   `confirm_pending_desktop_login(code, {"token": issue_platform_token(...)})`.
   ⚠️ Токен передаётся **в функцию**, а не мутацией локального `entry` — Redis возвращает копию
   (`json.loads`), и мутация не долетала: статус отдавал `confirmed=true, token=null`, страница висела до таймаута.
5. `desktop-status` отдаёт токен ровно один раз и гасит запись (`pop_pending_desktop_login`).
   Страница кладёт его в `localStorage.cabinet_bearer`, ставит `userRole=admin`, уходит на `/admin`.

Аварийный доступ, если Telegram недоступен: `scripts/issue_superadmin_token.py` (только внутри контейнера).

---

## 6. Создание пользователя: `get_or_create_oauth_user`

[routers/auth.py:577-660](../routers/auth.py#L577-L660). Для `provider="telegram"`:

- поиск **только** по `User.telegram_id == provider_id`;
- **fallback по email запрещён намеренно**: email синтетический и предсказуемый
  (`tg_<telegram_id>@telegram.user`), а `telegram_id` не секрет — иначе злоумышленник,
  зарегистрировав `tg_<чужой_id>@telegram.user`, перехватывал бы чужую сессию;
- регистрация на домене `@telegram.user` через обычную форму заблокирована ([auth.py:344-348](../routers/auth.py#L344-L348));
- если такой email занят чужой записью — создаётся новый пользователь с изменённым email (лог `telegram: email %s занят чужой записью`);
- новому пользователю проставляются `telegram_id` и `tg_username`.

Магазина у нового пользователя нет → `needs_setup=true` → фронт ведёт в онбординг создания магазина.

---

## 7. Хранение сессии

- Bearer выпускается `generate_token()` = `secrets.token_urlsafe(32)` (не JWT).
- `store_token()` ([auth_utils.py:50-59](../auth_utils.py#L50-L59)) — Redis `auth:<token>` с `TOKEN_TTL`, фолбэк in-memory.
- Чтение продлевает TTL (sliding session). Одноразовые telegram-токены входа живут отдельно и НЕ продлеваются.
- Фронт хранит под ключом **`cabinet_bearer`** — один и тот же ключ в трёх местах, менять только все сразу:
  [public/js/auth-storage.js](../public/js/auth-storage.js), [Cabinet_react_New/frontend/src/auth.js](../Cabinet_react_New/frontend/src/auth.js),
  inline-скрипт в [routers/auth.py:1039](../routers/auth.py#L1039).

---

## 8. Переменные окружения

| Переменная | Где читается | Зачем |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `config/oauth.py:30` | токен `@Grammerce_bot`; проверка подписи `initData`, отправка уведомлений |
| `TELEGRAM_BOT_USERNAME` | `config/oauth.py:31` | построение `t.me/<bot>?start=register` |
| `PLATFORM_BOT_SHARED_SECRET` | `config/oauth.py:35` | `X-Bot-Secret` для `issue` и для `/notify` бота |
| `PLATFORM_BOT_NOTIFY_URL` | `config/oauth.py:39` | куда платформа шлёт уведомления боту |
| `BACKEND_URL` | `config/oauth.py:54` | база для `consume_url`, `confirm_url`, `/login` |
| `SUPERADMIN_TELEGRAM_IDS` | `config/settings.py` | белый список id суперадминов (fail-closed) |
| `PLATFORM_MANAGER_CHAT_ID` | `config/oauth.py:50` | чат менеджера для заявок Setup Fee (к входу не относится) |

Не путать `TELEGRAM_BOT_TOKEN` (маркет-бот платформы) и `BOT_TOKEN` (шоп-бот демо-магазина).

---

## 9. Типовые сбои и их причина

| Симптом | Причина | Где смотреть |
|---|---|---|
| `?error=auth_expired` | `consume_url` уже использован или старше 5 мин (частый случай — нажали старую кнопку в истории чата) | бот обязан звать `issue` заново на КАЖДЫЙ `/start` |
| Mini App показывает форму логина вместо кабинета | пустой `initData` — не сделан `/setdomain` в @BotFather, либо кнопка не `WebAppInfo` | `auth.js:52` |
| 401 `Invalid Telegram WebApp data` | подпись проверяется другим токеном бота, чем тот, что открыл WebApp | `TELEGRAM_BOT_TOKEN` |
| Суперадмин: страница подтверждения висит до таймаута | регрессия «Redis отдаёт копию» (см. §5.2 п.4) | `confirm_pending_desktop_login` |
| 501 `Platform bot secret not configured` | пустой `PLATFORM_BOT_SHARED_SECRET` на сервере | `.env` |

---

## 10. Тесты

```bash
pytest tests/ -k "telegram or superadmin_tg or auth" -v
```
Релевантные файлы: `tests/test_superadmin_tg.db`-сценарии, `tests/test_platform_bot_notify.py`, `tests/test_referrals.py`
(там же используется `X-Bot-Secret`).

---

## 11. Файлы, которые нужно открыть следующему агенту

- [routers/auth.py:916-1301](../routers/auth.py#L916-L1301) — все telegram-эндпоинты
- [bot/handlers/registration.py:285-344](../bot/handlers/registration.py#L285-L344) — `/start register`
- [utils/telegram_auth.py](../utils/telegram_auth.py) — проверка подписи `initData`
- [auth_utils.py:50-120, 533-673](../auth_utils.py#L533-L673) — токены, pending-логины, суперадмин
- [public/js/auth.js](../public/js/auth.js) + [public/login.html](../public/login.html) — фронт входа
- [config/oauth.py](../config/oauth.py) — env
- [schemas.py](../schemas.py) — `TelegramAuthIssueRequest/Response`, `TelegramWebAppAuthRequest`
- [migrations/031_bot_auth_tokens.sql](../migrations/031_bot_auth_tokens.sql), [037](../migrations/037_bot_auth_token_lang.sql)

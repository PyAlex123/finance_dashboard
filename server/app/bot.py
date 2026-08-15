"""Минимальный процесс-бот Telegram (второй сервис в том же compose).

Задачи (без бизнес-логики — весь кабинет в Web App):
  1. на `/start` (в т.ч. `/start register` по ссылке с сайта) просить у API
     одноразовую ссылку входа и присылать её кнопкой — клик открывает браузер,
     где пользователь оказывается уже залогиненным;
  2. рядом — кнопка Web App, чтобы открыть кабинет прямо в Telegram;
  3. поставить левую кнопку-меню чата «Кабинет», открывающую тот же Web App.

Реализовано на stdlib (`urllib`) — без новых зависимостей. Long-polling getUpdates:
одному токену — один потребитель обновлений, поэтому вебхук перед стартом снимаем.

Запуск: `python -m app.bot` (в образе app; переменные TELEGRAM_BOT_TOKEN, WEBAPP_URL,
INTERNAL_API_URL и JWT_SECRET — последним подписываем запрос к своему же API).
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

from .auth import jwt_encode
from .bot_i18n import bt
from .config import INTERNAL_API_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN, WEBAPP_URL

API = "https://api.telegram.org/bot{token}/{method}"


def api(method: str, payload: dict | None = None, timeout: int = 65) -> dict:
    """POST JSON в Bot API. Возвращает разобранный ответ (или {'ok': False,...})."""
    url = API.format(token=TELEGRAM_BOT_TOKEN, method=method)
    data = json.dumps(payload or {}).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode())
        except Exception:  # noqa: BLE001
            return {"ok": False, "error": f"HTTP {e.code}"}
    except Exception as e:  # noqa: BLE001 — сеть/timeout: вернём, чтобы цикл продолжился
        return {"ok": False, "error": str(e)}


def set_menu_button() -> None:
    """Левая кнопка-меню чата «Кабинет» → открывает Web App (для всех пользователей).

    ОГРАНИЧЕНИЕ: setChatMenuButton вызывается здесь глобально, без области чата,
    поэтому подпись физически не может зависеть от языка конкретного человека —
    она одна на всех. Остаётся русской до перехода на вызовы со
    scope={'type': 'chat', 'chat_id': …} для каждого чата отдельно.
    """
    r = api("setChatMenuButton", {
        "menu_button": {
            "type": "web_app",
            "text": "Кабинет",
            "web_app": {"url": WEBAPP_URL},
        }
    })
    print("setChatMenuButton:", r.get("ok"), r.get("description", ""), flush=True)


def issue_login_link(user: dict) -> dict | None:
    """Попросить у своего API одноразовую ссылку входа для этого пользователя.

    Эндпоинт доступен снаружи (через nginx), поэтому подписываем запрос коротким
    JWT на общем JWT_SECRET (`bot: true`) — отдельного секрета заводить не нужно.
    """
    token = jwt_encode({"bot": True}, JWT_SECRET, 60)
    url = f"{INTERNAL_API_URL.rstrip('/')}/api/auth/telegram/issue"
    payload = {
        "telegram_id": str(user.get("id")),
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "username": user.get("username"),
    }
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:  # noqa: BLE001 — сеть/API недоступны: скажем пользователю
        print("issue_login_link:", e, flush=True)
        return None


def send_login_link(chat_id: int, user: dict) -> None:
    """Ответ на /start: ссылка для входа с компьютера.

    Ссылку выпускаем на КАЖДЫЙ /start: она одноразовая и живёт минуты, поэтому
    старая кнопка в истории чата всегда будет «устаревшей» — это ожидаемо.
    """
    link = issue_login_link(user)
    if not link:
        api("sendMessage", {
            "chat_id": chat_id,
            "text": bt("login.failed", user),
        })
        return
    api("sendMessage", {
        "chat_id": chat_id,
        "text": bt("login.body", user),
        "reply_markup": {
            "inline_keyboard": [
                [{"text": bt("login.open" if link.get("hasData") else "login.start", user),
                  "url": link["consumeUrl"]}],
                [{"text": bt("login.inTelegram", user), "web_app": {"url": WEBAPP_URL}}],
            ]
        },
    })


def handle_update(upd: dict) -> None:
    msg = upd.get("message") or upd.get("edited_message")
    if not msg:
        return
    text = (msg.get("text") or "").strip()
    chat_id = msg.get("chat", {}).get("id")
    if chat_id is None:
        return
    # На любой /start (в т.ч. «/start register» с сайта) выдаём свежую ссылку входа.
    if text.startswith("/start"):
        send_login_link(chat_id, msg.get("from") or {})


def main() -> None:
    if not TELEGRAM_BOT_TOKEN:
        raise SystemExit("TELEGRAM_BOT_TOKEN не задан — бот не запускается")
    if not WEBAPP_URL:
        raise SystemExit("WEBAPP_URL не задан — кнопки Web App собрать нельзя")

    # Один потребитель getUpdates на токен: снимаем возможный вебхук.
    api("deleteWebhook", {"drop_pending_updates": False})
    set_menu_button()
    print("Бот запущен, ожидаю сообщения…", flush=True)

    offset = 0
    while True:
        resp = api("getUpdates", {"offset": offset, "timeout": 50})
        if not resp.get("ok"):
            # Сеть/временная ошибка — короткая пауза и повтор.
            time.sleep(3)
            continue
        for upd in resp.get("result", []):
            offset = max(offset, upd["update_id"] + 1)
            try:
                handle_update(upd)
            except Exception as e:  # noqa: BLE001 — одно битое сообщение не роняет бота
                print("Ошибка обработки update:", e, flush=True)


if __name__ == "__main__":
    main()

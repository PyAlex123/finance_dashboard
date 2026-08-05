"""Минимальный процесс-бот Telegram (второй сервис в том же compose).

Задачи (без бизнес-логики — весь кабинет в Web App):
  1. на `/start` отвечать сообщением с inline-кнопкой Web App «Открыть платформу»;
  2. поставить левую кнопку-меню чата «Кабинет», открывающую тот же Web App;
  3. подтверждать вход с компьютера: `/start <nonce>` (ссылка с сайта) → кнопка
     «Войти с компьютера» → сообщаем об этом API, вкладка сайта сама входит.

Реализовано на stdlib (`urllib`) — без новых зависимостей. Long-polling getUpdates:
одному токену — один потребитель обновлений, поэтому вебхук перед стартом снимаем.

Запуск: `python -m app.bot` (в образе app; переменные TELEGRAM_BOT_TOKEN, WEBAPP_URL,
INTERNAL_API_URL и JWT_SECRET — последним подписываем запрос к своему же API).
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.request

from .auth import jwt_encode
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
    """Левая кнопка-меню чата «Кабинет» → открывает Web App (для всех пользователей)."""
    r = api("setChatMenuButton", {
        "menu_button": {
            "type": "web_app",
            "text": "Кабинет",
            "web_app": {"url": WEBAPP_URL},
        }
    })
    print("setChatMenuButton:", r.get("ok"), r.get("description", ""), flush=True)


def send_start(chat_id: int) -> None:
    """Ответ на /start: приветствие + inline-кнопка Web App «Открыть платформу»."""
    api("sendMessage", {
        "chat_id": chat_id,
        "text": (
            "Добро пожаловать в финансовую платформу.\n"
            "Нажмите кнопку ниже, чтобы открыть кабинет, или используйте кнопку "
            "«Кабинет» слева от поля ввода."
        ),
        "reply_markup": {
            "inline_keyboard": [[
                {"text": "🚀 Открыть платформу", "web_app": {"url": WEBAPP_URL}}
            ]]
        },
    })


def approve_login(nonce: str, user: dict) -> bool:
    """Сообщить своему API, что вход подтверждён. Эндпоинт доступен снаружи, поэтому
    подписываем запрос коротким JWT на общем JWT_SECRET (`bot: true`)."""
    token = jwt_encode({"bot": True}, JWT_SECRET, 60)
    url = f"{INTERNAL_API_URL.rstrip('/')}/api/auth/tg-link/approve"
    data = json.dumps({"nonce": nonce, "user": user}).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode()).get("status") in {"ok", "already"}
    except Exception as e:  # noqa: BLE001 — заявка могла истечь, скажем об этом пользователю
        print("approve_login:", e, flush=True)
        return False


def send_login_request(chat_id: int, nonce: str) -> None:
    """Ответ на переход по ссылке с сайта: спросить подтверждение входа."""
    code = hashlib.sha256(nonce.encode()).hexdigest()[:4].upper()
    api("sendMessage", {
        "chat_id": chat_id,
        "text": (
            "Вход с компьютера\n\n"
            f"Код на сайте: {code}\n"
            "Если код совпадает — подтвердите вход кнопкой ниже.\n\n"
            "Если вы сейчас никуда не входили — просто закройте этот чат "
            "и ничего не нажимайте."
        ),
        "reply_markup": {
            "inline_keyboard": [[
                {"text": "✅ Войти с компьютера", "callback_data": f"login:{nonce}"}
            ]]
        },
    })


def handle_callback(cb: dict) -> None:
    data = (cb.get("data") or "").strip()
    if not data.startswith("login:"):
        return
    nonce = data.removeprefix("login:")
    user = cb.get("from") or {}
    ok = approve_login(nonce, user)
    api("answerCallbackQuery", {
        "callback_query_id": cb["id"],
        "text": "Готово" if ok else "Срок действия ссылки истёк",
    })
    msg = cb.get("message") or {}
    chat_id = msg.get("chat", {}).get("id")
    if chat_id is None:
        return
    api("editMessageText", {
        "chat_id": chat_id,
        "message_id": msg.get("message_id"),
        "text": (
            "✅ Вход подтверждён — вернитесь на вкладку в браузере."
            if ok else
            "Ссылка устарела. Нажмите «Войти через Telegram» на сайте ещё раз."
        ),
    })


def handle_update(upd: dict) -> None:
    if upd.get("callback_query"):
        handle_callback(upd["callback_query"])
        return
    msg = upd.get("message") or upd.get("edited_message")
    if not msg:
        return
    text = (msg.get("text") or "").strip()
    chat_id = msg.get("chat", {}).get("id")
    if chat_id is None:
        return
    # /start с параметром — переход с сайта (подтверждение входа), без — приветствие.
    if text.startswith("/start"):
        payload = text.removeprefix("/start").strip()
        if payload:
            send_login_request(chat_id, payload)
        else:
            send_start(chat_id)


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

"""Минимальный процесс-бот Telegram (второй сервис в том же compose).

Задачи (ровно две, без бизнес-логики — весь кабинет в Web App):
  1. на `/start` отвечать сообщением с inline-кнопкой Web App «Открыть платформу»;
  2. поставить левую кнопку-меню чата «Кабинет», открывающую тот же Web App.

Реализовано на stdlib (`urllib`) — без новых зависимостей. Long-polling getUpdates:
одному токену — один потребитель обновлений, поэтому вебхук перед стартом снимаем.

Запуск: `python -m app.bot` (в образе app; переменные TELEGRAM_BOT_TOKEN, WEBAPP_URL).
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

from .config import TELEGRAM_BOT_TOKEN, WEBAPP_URL

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


def handle_update(upd: dict) -> None:
    msg = upd.get("message") or upd.get("edited_message")
    if not msg:
        return
    text = (msg.get("text") or "").strip()
    chat_id = msg.get("chat", {}).get("id")
    if chat_id is None:
        return
    # Реагируем на /start (в т.ч. с параметром: «/start abc»).
    if text == "/start" or text.startswith("/start"):
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

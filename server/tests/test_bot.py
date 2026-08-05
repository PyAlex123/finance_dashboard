"""Тесты процесса-бота: подтверждение входа с сайта. Запуск (из папки server):
    ./.venv/Scripts/python.exe tests/test_bot.py

Сеть не трогаем: подменяем `api` (Bot API) и `urlopen` (вызов своего же API).
"""
import json
import os

# окружение до импорта app.config/app.bot
os.environ["TELEGRAM_BOT_TOKEN"] = "123:TESTTOKEN"
os.environ["WEBAPP_URL"] = "https://example.test/dashboards/"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["INTERNAL_API_URL"] = "http://app:8000/dashboards"
os.environ.setdefault("DATABASE_URL", "sqlite:///./_bottest.db")

from app import bot  # noqa: E402
from app.auth import jwt_decode  # noqa: E402


class Recorder:
    """Подменяет bot.api и запоминает вызовы."""

    def __init__(self):
        self.calls = []

    def __call__(self, method, payload=None, timeout=65):
        self.calls.append((method, payload or {}))
        return {"ok": True}

    def payload(self, method):
        return next(p for m, p in self.calls if m == method)

    def methods(self):
        return [m for m, _ in self.calls]


def test_plain_start_offers_webapp():
    rec = Recorder()
    original, bot.api = bot.api, rec
    try:
        bot.handle_update({"message": {"chat": {"id": 1}, "text": "/start"}})
    finally:
        bot.api = original
    button = rec.payload("sendMessage")["reply_markup"]["inline_keyboard"][0][0]
    assert "web_app" in button


def test_start_with_nonce_asks_confirmation():
    rec = Recorder()
    original, bot.api = bot.api, rec
    try:
        bot.handle_update({"message": {"chat": {"id": 1}, "text": "/start abc123"}})
    finally:
        bot.api = original
    msg = rec.payload("sendMessage")
    button = msg["reply_markup"]["inline_keyboard"][0][0]
    assert button["callback_data"] == "login:abc123"
    # код для сверки считается так же, как на сервере
    from app.main import login_code
    assert login_code("abc123") in msg["text"]


def test_callback_approves_login():
    rec = Recorder()
    sent = {}

    class FakeResponse:
        def read(self):
            return json.dumps({"status": "ok"}).encode()

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def fake_urlopen(req, timeout=15):
        sent["url"] = req.full_url
        sent["body"] = json.loads(req.data.decode())
        sent["auth"] = req.get_header("Authorization")
        return FakeResponse()

    original_api, bot.api = bot.api, rec
    original_open, bot.urllib.request.urlopen = bot.urllib.request.urlopen, fake_urlopen
    try:
        bot.handle_update({
            "callback_query": {
                "id": "cb1",
                "data": "login:abc123",
                "from": {"id": 8, "first_name": "Вика", "username": "vika"},
                "message": {"chat": {"id": 1}, "message_id": 5},
            }
        })
    finally:
        bot.api = original_api
        bot.urllib.request.urlopen = original_open

    assert sent["url"] == "http://app:8000/dashboards/api/auth/tg-link/approve"
    assert sent["body"] == {"nonce": "abc123", "user": {"id": 8, "first_name": "Вика", "username": "vika"}}
    # запрос подписан токеном бота, а не пользовательским
    assert jwt_decode(sent["auth"].removeprefix("Bearer "), "test-secret")["bot"] is True
    # пользователю ответили и заменили сообщение
    assert "answerCallbackQuery" in rec.methods()
    assert "вернитесь" in rec.payload("editMessageText")["text"].lower()


def test_callback_reports_expired_link():
    rec = Recorder()

    def failing_urlopen(req, timeout=15):
        raise OSError("404")

    original_api, bot.api = bot.api, rec
    original_open, bot.urllib.request.urlopen = bot.urllib.request.urlopen, failing_urlopen
    try:
        bot.handle_update({
            "callback_query": {
                "id": "cb2", "data": "login:stale", "from": {"id": 8},
                "message": {"chat": {"id": 1}, "message_id": 5},
            }
        })
    finally:
        bot.api = original_api
        bot.urllib.request.urlopen = original_open

    assert "устарела" in rec.payload("editMessageText")["text"].lower()


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"BOT TESTS OK ({len(fns)})")

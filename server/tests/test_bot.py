"""Тесты процесса-бота: выдача ссылки для входа с компьютера. Запуск (из папки server):
    ./.venv/Scripts/python.exe tests/test_bot.py

Сеть не трогаем: подменяем `api` (Bot API) и `urlopen` (вызов своего же API).
"""
import json
import os

# окружение до импорта app.config/app.bot
os.environ["TELEGRAM_BOT_TOKEN"] = "123:TESTTOKEN"
os.environ["WEBAPP_URL"] = "https://finlo.test/"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["INTERNAL_API_URL"] = "http://app:8000"
os.environ.setdefault("DATABASE_URL", "sqlite:///./_bottest.db")

from app import bot  # noqa: E402
from app.auth import jwt_decode  # noqa: E402

USER = {"id": 8, "first_name": "Вика", "username": "vika"}


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


class FakeIssue:
    """Подменяет urlopen: отдаёт ответ /auth/telegram/issue и пишет, что спросили."""

    def __init__(self, has_data=False, fail=False):
        self.has_data = has_data
        self.fail = fail
        self.requests = []

    def __call__(self, req, timeout=15):
        self.requests.append({
            "url": req.full_url,
            "body": json.loads(req.data.decode()),
            "auth": req.get_header("Authorization"),
        })
        if self.fail:
            raise OSError("503")
        token = f"tok{len(self.requests)}"
        return _Response({
            "token": token,
            "consumeUrl": f"https://finlo.test/api/auth/telegram/consume?token={token}",
            "expiresIn": 300,
            "hasData": self.has_data,
        })


class _Response:
    def __init__(self, body):
        self._body = json.dumps(body).encode()

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def run_start(text, issue, rec):
    """Прогоняет /start через бота с подменёнными сетевыми вызовами."""
    original_api, bot.api = bot.api, rec
    original_open, bot.urllib.request.urlopen = bot.urllib.request.urlopen, issue
    try:
        bot.handle_update({"message": {"chat": {"id": 1}, "text": text, "from": USER}})
    finally:
        bot.api = original_api
        bot.urllib.request.urlopen = original_open


def test_start_register_sends_login_link():
    rec, issue = Recorder(), FakeIssue()
    run_start("/start register", issue, rec)

    # запрос ушёл на issue, подписан токеном бота, с профилем пользователя
    assert len(issue.requests) == 1
    sent = issue.requests[0]
    assert sent["url"] == "http://app:8000/api/auth/telegram/issue"
    assert sent["body"]["telegram_id"] == "8"
    assert sent["body"]["first_name"] == "Вика"
    assert jwt_decode(sent["auth"].removeprefix("Bearer "), "test-secret")["bot"] is True

    # пользователю пришла кнопка-ссылка (URL, а не callback) и кнопка Web App
    keyboard = rec.payload("sendMessage")["reply_markup"]["inline_keyboard"]
    assert keyboard[0][0]["url"].endswith("consume?token=tok1")
    assert keyboard[0][0]["text"] == "✅ Начать бесплатно"  # данных ещё нет
    assert "web_app" in keyboard[1][0]


def test_plain_start_also_issues_link():
    rec, issue = Recorder(), FakeIssue(has_data=True)
    run_start("/start", issue, rec)
    keyboard = rec.payload("sendMessage")["reply_markup"]["inline_keyboard"]
    assert keyboard[0][0]["text"] == "🚀 Открыть finlo"  # пользователь уже заведён


def test_each_start_issues_fresh_link():
    """Ссылка одноразовая, поэтому на каждый /start выпускается новая."""
    rec, issue = Recorder(), FakeIssue()
    run_start("/start register", issue, rec)
    run_start("/start register", issue, rec)

    assert len(issue.requests) == 2
    urls = [p["reply_markup"]["inline_keyboard"][0][0]["url"]
            for m, p in rec.calls if m == "sendMessage"]
    assert urls[0] != urls[1]


def test_issue_failure_tells_user():
    rec, issue = Recorder(), FakeIssue(fail=True)
    run_start("/start", issue, rec)
    msg = rec.payload("sendMessage")
    assert "не удалось" in msg["text"].lower()
    assert "reply_markup" not in msg  # кнопки нет — нажимать нечего


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"BOT TESTS OK ({len(fns)})")

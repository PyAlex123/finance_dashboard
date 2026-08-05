"""Тесты Telegram-авторизации (Фаза 5). Запуск (из папки server):
    ./.venv/Scripts/python.exe -m pytest tests/test_auth.py -q
или без pytest — как скрипт:
    ./.venv/Scripts/python.exe tests/test_auth.py
"""
import hashlib
import hmac
import json
import os
import time
from urllib.parse import urlencode

# окружение до импорта app.config/app.main
os.environ["TELEGRAM_BOT_TOKEN"] = "123:TESTTOKEN"
os.environ["JWT_SECRET"] = "test-secret"
os.environ.setdefault("DATABASE_URL", "sqlite:///./_authtest.db")

from app.auth import (  # noqa: E402
    AuthError, jwt_decode, jwt_encode, validate_init_data, validate_login_widget, workspace_for,
)

BOT = "123:TESTTOKEN"


def make_widget_data(user: dict, bot: str = BOT, auth_date: int | None = None) -> dict:
    """Собирает подписанные данные кнопки Login Widget (секрет — SHA256 токена)."""
    data = {**user, "auth_date": auth_date or int(time.time())}
    dcs = "\n".join(f"{k}={data[k]}" for k in sorted(data))
    secret = hashlib.sha256(bot.encode()).digest()
    return {**data, "hash": hmac.new(secret, dcs.encode(), hashlib.sha256).hexdigest()}


def make_init_data(user: dict, bot: str = BOT, auth_date: int | None = None) -> str:
    """Собирает корректно подписанный initData (как это делает Telegram)."""
    fields = {
        "auth_date": str(auth_date or int(time.time())),
        "user": json.dumps(user, separators=(",", ":")),
    }
    dcs = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret = hmac.new(b"WebAppData", bot.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, dcs.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def test_valid_init_data():
    user = validate_init_data(make_init_data({"id": 42, "first_name": "Алекс"}), BOT)
    assert user["id"] == 42
    assert workspace_for(user) == "tg:42"


def test_tampered_hash_rejected():
    init = make_init_data({"id": 42})
    try:
        validate_init_data(init[:-4] + "dead", BOT)
        assert False, "ожидалась AuthError"
    except AuthError:
        pass


def test_wrong_bot_token_rejected():
    init = make_init_data({"id": 42}, bot="999:OTHER")
    try:
        validate_init_data(init, BOT)
        assert False, "ожидалась AuthError"
    except AuthError:
        pass


def test_expired_init_data_rejected():
    init = make_init_data({"id": 42}, auth_date=int(time.time()) - 10_000)
    try:
        validate_init_data(init, BOT, max_age=3600)
        assert False, "ожидалась AuthError"
    except AuthError:
        pass


def test_valid_widget_data():
    user = validate_login_widget(make_widget_data({"id": 42, "first_name": "Алекс"}), BOT)
    assert user["id"] == 42
    assert workspace_for(user) == "tg:42"
    assert "hash" not in user


def test_widget_tampered_rejected():
    data = make_widget_data({"id": 42, "first_name": "Алекс"})
    data["first_name"] = "Мэллори"  # подпись считалась по прежнему имени
    try:
        validate_login_widget(data, BOT)
        assert False, "ожидалась AuthError"
    except AuthError:
        pass


def test_widget_wrong_bot_token_rejected():
    try:
        validate_login_widget(make_widget_data({"id": 42}, bot="999:OTHER"), BOT)
        assert False, "ожидалась AuthError"
    except AuthError:
        pass


def test_widget_expired_rejected():
    data = make_widget_data({"id": 42}, auth_date=int(time.time()) - 10_000)
    try:
        validate_login_widget(data, BOT, max_age=3600)
        assert False, "ожидалась AuthError"
    except AuthError:
        pass


def test_jwt_roundtrip():
    assert jwt_decode(jwt_encode({"sub": "tg:42"}, "s", 60), "s")["sub"] == "tg:42"


def test_jwt_wrong_secret():
    tok = jwt_encode({"sub": "x"}, "s", 60)
    try:
        jwt_decode(tok, "other")
        assert False
    except AuthError:
        pass


def test_jwt_expired():
    try:
        jwt_decode(jwt_encode({"sub": "x"}, "s", -1), "s")
        assert False
    except AuthError:
        pass


def test_endpoint_and_workspace_guard():
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as c:
        # health сообщает, что Telegram-логин включён
        assert c.get("/api/health").json()["telegramAuth"] is True

        r = c.post("/api/auth/telegram", json={"initData": make_init_data({"id": 7, "first_name": "Боб"})})
        assert r.status_code == 200, r.text
        tok, ws = r.json()["token"], r.json()["workspace"]
        assert ws == "tg:7"

        # tg-пространство без токена — 401
        assert c.get(f"/api/snapshot/{ws}").status_code == 401
        # с валидным токеном — доступ есть (404, т.к. пусто)
        assert c.get(f"/api/snapshot/{ws}", headers={"Authorization": f"Bearer {tok}"}).status_code == 404
        # чужое tg-пространство с этим токеном — 403
        assert c.get("/api/snapshot/tg:999", headers={"Authorization": f"Bearer {tok}"}).status_code == 403
        # обычное имя (не tg:) остаётся открытым (локальный режим/LAN)
        assert c.get("/api/snapshot/Алекс").status_code == 404

        # битый initData — 401
        assert c.post("/api/auth/telegram", json={"initData": "user=%7B%7D&hash=bad"}).status_code == 401


def test_widget_endpoint_registers_user():
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as c:
        data = make_widget_data({"id": 8, "first_name": "Вика", "username": "vika"})
        r = c.post("/api/auth/telegram-widget", json=data)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["workspace"] == "tg:8"
        assert body["name"] == "Вика"

        # выданный токен открывает своё пространство (404 — снимка ещё нет)
        headers = {"Authorization": f"Bearer {body['token']}"}
        assert c.get("/api/snapshot/tg:8", headers=headers).status_code == 404

        # подделанные данные — 401
        assert c.post("/api/auth/telegram-widget", json={**data, "id": 9}).status_code == 401


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"AUTH TESTS OK ({len(fns)})")

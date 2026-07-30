"""Тесты админ-доступа к списку пользователей.
Запуск (из папки server):
    PYTHONPATH=. ./.venv/Scripts/python.exe tests/test_admin.py
"""
import hashlib
import hmac
import json
import os
import time
from urllib.parse import urlencode

# окружение до импорта app.config/app.main — своя БД + админ по id 500
os.environ["TELEGRAM_BOT_TOKEN"] = "123:TESTTOKEN"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["DATABASE_URL"] = "sqlite:///./_admintest.db"
os.environ["ADMIN_TG_IDS"] = "500"

BOT = "123:TESTTOKEN"


def make_init_data(user: dict, bot: str = BOT) -> str:
    fields = {"auth_date": str(int(time.time())), "user": json.dumps(user, separators=(",", ":"))}
    dcs = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret = hmac.new(b"WebAppData", bot.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, dcs.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def _client():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


def _login(c, user: dict) -> str:
    r = c.post("/api/auth/telegram", json={"initData": make_init_data(user)})
    assert r.status_code == 200, r.text
    return r.json()


def test_auth_marks_admin():
    with _client() as c:
        admin = _login(c, {"id": 500, "first_name": "Босс", "username": "boss"})
        assert admin["isAdmin"] is True
        user = _login(c, {"id": 501, "first_name": "Юзер", "username": "u1"})
        assert user["isAdmin"] is False


def test_admin_users_list_and_guard():
    with _client() as c:
        admin = _login(c, {"id": 500, "first_name": "Босс", "username": "boss"})
        _login(c, {"id": 501, "first_name": "Юзер", "username": "u1"})
        atok = admin["token"]

        # без токена — 401
        assert c.get("/api/admin/users").status_code == 401
        # не-админ — 403
        utok = _login(c, {"id": 502, "first_name": "Гость"})["token"]
        assert c.get("/api/admin/users", headers={"Authorization": f"Bearer {utok}"}).status_code == 403

        # админ — список со всеми зарегистрированными
        r = c.get("/api/admin/users", headers={"Authorization": f"Bearer {atok}"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["count"] >= 3
        names = {u["username"] for u in body["users"]}
        assert "boss" in names and "u1" in names


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    dbfile = "./_admintest.db"
    if os.path.exists(dbfile):
        os.remove(dbfile)
    for fn in fns:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"ADMIN TESTS OK ({len(fns)})")

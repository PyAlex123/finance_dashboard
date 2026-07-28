"""Тесты реестра отчётов, доступа к под-ключам и авто-регистрации пользователя.
Запуск (из папки server):
    PYTHONPATH=. ./.venv/Scripts/python.exe tests/test_reports.py
"""
import hashlib
import hmac
import json
import os
import time
from urllib.parse import urlencode

# окружение до импорта app.config/app.main — своя БД, чтобы не мешать другим тестам
os.environ["TELEGRAM_BOT_TOKEN"] = "123:TESTTOKEN"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["DATABASE_URL"] = "sqlite:///./_reportstest.db"

BOT = "123:TESTTOKEN"


def make_init_data(user: dict, bot: str = BOT, auth_date: int | None = None) -> str:
    fields = {
        "auth_date": str(auth_date or int(time.time())),
        "user": json.dumps(user, separators=(",", ":")),
    }
    dcs = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret = hmac.new(b"WebAppData", bot.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, dcs.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def _client():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


def _login(c, user: dict) -> tuple[str, str]:
    r = c.post("/api/auth/telegram", json={"initData": make_init_data(user)})
    assert r.status_code == 200, r.text
    j = r.json()
    return j["token"], j["workspace"]


def test_auth_returns_profile_and_registers():
    with _client() as c:
        r = c.post("/api/auth/telegram", json={
            "initData": make_init_data({
                "id": 100, "first_name": "Аня", "username": "anya",
                "photo_url": "https://t.me/i/anya.jpg",
            })
        })
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["workspace"] == "tg:100"
        assert j["username"] == "anya"
        assert j["photoUrl"] == "https://t.me/i/anya.jpg"

        # запись пользователя создалась (реестр/регистрация)
        from app.db import SessionLocal
        from app import models
        db = SessionLocal()
        try:
            u = db.get(models.User, "tg:100")
            assert u is not None and u.username == "anya"
            assert u.created_at is not None and u.last_seen is not None
        finally:
            db.close()


def test_reports_crud_and_isolation():
    with _client() as c:
        tok, ws = _login(c, {"id": 200, "first_name": "Боб"})
        h = {"Authorization": f"Bearer {tok}"}

        # пусто
        assert c.get("/api/reports", params={"owner": ws, "form": "bs"}, headers=h).json() == []

        # создать два баланса
        a = c.post("/api/reports", json={"owner": ws, "form": "bs", "name": "Июль"}, headers=h)
        b = c.post("/api/reports", json={"owner": ws, "form": "bs", "name": "Август"}, headers=h)
        assert a.status_code == 200 and b.status_code == 200, (a.text, b.text)
        rid_a = a.json()["id"]
        assert rid_a.startswith("tg:200:bs:")

        lst = c.get("/api/reports", params={"owner": ws, "form": "bs"}, headers=h).json()
        assert {r["name"] for r in lst} == {"Июль", "Август"}

        # тело отчёта пишется/читается под тем же id (под-ключ владельца)
        assert c.put(f"/api/snapshot/{rid_a}", json={"data": {"x": 1}}, headers=h).status_code == 200
        assert c.get(f"/api/snapshot/{rid_a}", headers=h).json()["data"] == {"x": 1}

        # переименование
        assert c.patch(f"/api/reports/{rid_a}", json={"name": "Q3"}, headers=h).json()["name"] == "Q3"

        # удаление отчёта уносит и тело-снимок
        assert c.delete(f"/api/reports/{rid_a}", headers=h).status_code == 200
        assert c.get(f"/api/snapshot/{rid_a}", headers=h).status_code == 404
        left = c.get("/api/reports", params={"owner": ws, "form": "bs"}, headers=h).json()
        assert [r["name"] for r in left] == ["Август"]


def test_form_filter():
    with _client() as c:
        tok, ws = _login(c, {"id": 300, "first_name": "Кэт"})
        h = {"Authorization": f"Bearer {tok}"}
        c.post("/api/reports", json={"owner": ws, "form": "bs", "name": "Б1"}, headers=h)
        c.post("/api/reports", json={"owner": ws, "form": "cf", "name": "Д1"}, headers=h)
        bs = c.get("/api/reports", params={"owner": ws, "form": "bs"}, headers=h).json()
        allr = c.get("/api/reports", params={"owner": ws}, headers=h).json()
        assert [r["name"] for r in bs] == ["Б1"]
        assert len(allr) == 2


def test_sub_key_access_guard():
    with _client() as c:
        tok, ws = _login(c, {"id": 400, "first_name": "Дэн"})
        h = {"Authorization": f"Bearer {tok}"}
        rid = c.post("/api/reports", json={"owner": ws, "form": "bs", "name": "мой"}, headers=h).json()["id"]

        # свой под-ключ с токеном — доступ есть (404, пусто)
        assert c.get(f"/api/snapshot/{rid}", headers=h).status_code == 404
        # свой под-ключ без токена — 401
        assert c.get(f"/api/snapshot/{rid}").status_code == 401

        # чужой под-ключ этим токеном — 403
        assert c.get("/api/snapshot/tg:999:bs:aaaa", headers=h).status_code == 403
        # список отчётов чужого владельца — 403
        assert c.get("/api/reports", params={"owner": "tg:999"}, headers=h).status_code == 403
        # префикс не должен «протекать»: tg:4 не владеет tg:400:...
        tok4, _ = _login(c, {"id": 4, "first_name": "Икс"})
        assert c.get(f"/api/snapshot/{rid}", headers={"Authorization": f"Bearer {tok4}"}).status_code == 403


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    # свежая БД для детерминизма
    dbfile = "./_reportstest.db"
    if os.path.exists(dbfile):
        os.remove(dbfile)
    for fn in fns:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"REPORTS TESTS OK ({len(fns)})")

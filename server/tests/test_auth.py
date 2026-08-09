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
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

# окружение до импорта app.config/app.main
os.environ["TELEGRAM_BOT_TOKEN"] = "123:TESTTOKEN"
os.environ["TELEGRAM_BOT_USERNAME"] = "testbot"  # чтобы не ходить в getMe
os.environ["GOOGLE_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["WEBAPP_URL"] = "https://finlo.test/"  # из него берётся origin ссылок входа
os.environ.setdefault("DATABASE_URL", "sqlite:///./_authtest.db")

from app.auth import (  # noqa: E402
    AuthError, jwt_decode, jwt_encode, validate_init_data, workspace_for,
)

BOT = "123:TESTTOKEN"
GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com"


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


def test_google_token_checks():
    """Подпись проверяет сам Google (tokeninfo) — мы сверяем aud/iss/exp/почту."""
    from app import providers

    base = {
        "sub": "1122", "aud": GOOGLE_CLIENT_ID, "iss": "https://accounts.google.com",
        "exp": str(int(time.time()) + 600), "email_verified": "true",
        "email": "u@example.com", "given_name": "Вика",
    }
    original = providers._get_json
    try:
        providers._get_json = lambda url, timeout=10: base
        user = providers.verify_google_id_token("token")
        assert user["id"] == "1122"
        assert workspace_for(user, "g") == "g:1122"

        for broken in (
            {**base, "aud": "someone-else"},          # токен другого приложения
            {**base, "iss": "evil.example"},          # чужой издатель
            {**base, "exp": str(int(time.time()) - 5)},  # истёк
            {**base, "email_verified": "false"},      # почта не подтверждена
            {},                                       # Google не ответил
        ):
            providers._get_json = lambda url, timeout=10, b=broken: b
            try:
                providers.verify_google_id_token("token")
                assert False, f"ожидалась AuthError для {broken}"
            except AuthError:
                pass
    finally:
        providers._get_json = original


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


def test_tg_link_login_flow():
    """Вход с компьютера: бот выпускает одноразовую ссылку → переход по ней логинит."""
    from fastapi.testclient import TestClient
    from app.main import app

    bot_headers = {"Authorization": f"Bearer {jwt_encode({'bot': True}, 'test-secret', 60)}"}
    issue_body = {"telegram_id": "8", "first_name": "Вика", "username": "vika"}

    with TestClient(app, follow_redirects=False) as c:
        # кнопка на сайте ведёт в бота
        r = c.get("/api/auth/telegram")
        assert r.status_code == 303
        assert r.headers["location"] == "https://t.me/testbot?start=register"

        # выпускать ссылки может только бот
        assert c.post("/api/auth/telegram/issue", json=issue_body).status_code == 401
        assert c.post(
            "/api/auth/telegram/issue", json=issue_body,
            headers={"Authorization": f"Bearer {jwt_encode({'sub': 'tg:8'}, 'test-secret', 60)}"},
        ).status_code == 401

        issued = c.post("/api/auth/telegram/issue", json=issue_body, headers=bot_headers)
        assert issued.status_code == 200, issued.text
        link = issued.json()
        token = link["token"]
        # ссылка абсолютная — её открывают из Telegram в браузере
        assert link["consumeUrl"] == f"https://finlo.test/api/auth/telegram/consume?token={token}"
        assert link["hasData"] is False  # пользователь ещё не заводился

        # переход по ссылке = вход: токен приезжает во фрагменте
        r = c.get(f"/api/auth/telegram/consume?token={token}")
        assert r.status_code == 303, r.text
        location = r.headers["location"]
        assert location.startswith("/login#token=")
        bearer = location.split("#token=")[1].split("&")[0]

        # ссылка одноразовая: повтор уводит на вход с понятной ошибкой
        again = c.get(f"/api/auth/telegram/consume?token={token}")
        assert again.status_code == 303
        assert again.headers["location"] == "/login?error=auth_expired"
        # неизвестный токен — туда же
        assert c.get("/api/auth/telegram/consume?token=nope").headers["location"] == "/login?error=auth_expired"

        # выданный Bearer открывает своё пространство и не открывает чужое
        headers = {"Authorization": f"Bearer {bearer}"}
        assert c.get("/api/snapshot/tg:8", headers=headers).status_code == 404
        assert c.get("/api/snapshot/tg:999", headers=headers).status_code == 403

        # профиль по токену — им фронт восстанавливает сессию после перезагрузки
        me = c.get("/api/auth/me", headers=headers)
        assert me.status_code == 200, me.text
        assert me.json()["workspace"] == "tg:8"
        assert me.json()["name"] == "Вика"
        assert me.json()["isAdmin"] is False
        assert c.get("/api/auth/me").status_code == 401
        assert c.get("/api/auth/me", headers={
            "Authorization": f"Bearer {jwt_encode({'sub': 'tg:8'}, 'other-secret', 60)}",
        }).status_code == 401

        # пользователь теперь известен — бот подпишет кнопку иначе
        assert c.post(
            "/api/auth/telegram/issue", json=issue_body, headers=bot_headers,
        ).json()["hasData"] is True

        # старой схемы больше нет
        assert c.post("/api/auth/tg-link/start").status_code == 404
        assert c.get("/api/auth/tg-link/whatever").status_code == 404


def test_consume_link_expires():
    """Протухшая ссылка не логинит, даже если ею не пользовались."""
    from fastapi.testclient import TestClient
    from app import models
    from app.db import SessionLocal
    from app.main import app

    bot_headers = {"Authorization": f"Bearer {jwt_encode({'bot': True}, 'test-secret', 60)}"}

    with TestClient(app, follow_redirects=False) as c:
        token = c.post(
            "/api/auth/telegram/issue", json={"telegram_id": "9"}, headers=bot_headers,
        ).json()["token"]

        db = SessionLocal()
        row = db.get(models.BotAuthToken, token)
        row.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
        db.commit()
        db.close()

        r = c.get(f"/api/auth/telegram/consume?token={token}")
        assert r.status_code == 303
        assert r.headers["location"] == "/login?error=auth_expired"


def test_google_endpoint_and_workspace_guard():
    from fastapi.testclient import TestClient
    from app import providers
    from app.main import app

    claims = {
        "sub": "77", "aud": GOOGLE_CLIENT_ID, "iss": "https://accounts.google.com",
        "exp": str(int(time.time()) + 600), "email_verified": "true",
        "email": "vika@example.com", "given_name": "Вика", "picture": "https://pic",
    }
    original = providers._get_json
    try:
        providers._get_json = lambda url, timeout=10: claims
        with TestClient(app) as c:
            r = c.post("/api/auth/google", json={"credential": "id-token"})
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["workspace"] == "g:77"
            assert body["photoUrl"] == "https://pic"

            headers = {"Authorization": f"Bearer {body['token']}"}
            # своё пространство доступно, чужое — нет, без токена — 401
            assert c.get("/api/snapshot/g:77", headers=headers).status_code == 404
            assert c.get("/api/snapshot/g:88", headers=headers).status_code == 403
            assert c.get("/api/snapshot/g:77").status_code == 401

            # публичный конфиг рассказывает фронту, что включено
            cfg = c.get("/api/config").json()
            assert cfg["telegramBot"] == "testbot"
            assert cfg["googleEnabled"] is True
    finally:
        providers._get_json = original


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"AUTH TESTS OK ({len(fns)})")

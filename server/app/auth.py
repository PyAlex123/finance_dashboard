"""Telegram Web App: проверка initData и собственный JWT (Фаза 5).

Бэкенд остаётся тонким: initData валидируется по HMAC-SHA256 с токеном бота
(алгоритм из документации Telegram), затем выдаётся короткий JWT (HS256),
который клиент шлёт в заголовке Authorization. Cookie в webview ненадёжны.

JWT реализован вручную (hmac+base64), чтобы не тянуть зависимость.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl


class AuthError(Exception):
    """Проблема аутентификации (невалидный initData/JWT)."""


# ---------- Telegram initData ----------

def validate_init_data(init_data: str, bot_token: str, max_age: int = 0) -> dict:
    """Проверяет подпись initData и возвращает объект пользователя (dict).

    Бросает AuthError при отсутствии/несовпадении подписи или устаревании.
    """
    if not bot_token:
        raise AuthError("Telegram-логин не настроен")
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise AuthError("В initData нет hash")

    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calc_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc_hash, received_hash):
        raise AuthError("Подпись initData не совпала")

    if max_age > 0:
        try:
            auth_date = int(pairs.get("auth_date", "0"))
        except ValueError:
            auth_date = 0
        if auth_date > 0 and (time.time() - auth_date) > max_age:
            raise AuthError("initData устарел")

    try:
        user = json.loads(pairs.get("user", "{}"))
    except json.JSONDecodeError as e:
        raise AuthError("Некорректный user в initData") from e
    if not isinstance(user, dict) or "id" not in user:
        raise AuthError("В initData нет пользователя")
    return user


# ---------- JWT (HS256) ----------

def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64url_decode(seg: str) -> bytes:
    return base64.urlsafe_b64decode(seg + "=" * (-len(seg) % 4))


def jwt_encode(payload: dict, secret: str, ttl: int) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    body = {**payload, "iat": now, "exp": now + ttl}
    signing_input = (
        _b64url(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + _b64url(json.dumps(body, separators=(",", ":")).encode())
    )
    sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    return signing_input + "." + _b64url(sig)


def jwt_decode(token: str, secret: str) -> dict:
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
    except ValueError as e:
        raise AuthError("Некорректный токен") from e
    expected = _b64url(
        hmac.new(secret.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(expected, sig_b64):
        raise AuthError("Подпись токена не совпала")
    payload = json.loads(_b64url_decode(payload_b64))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise AuthError("Токен истёк")
    return payload


def workspace_for(user: dict) -> str:
    """Рабочее пространство пользователя Telegram — стабильное по его id."""
    return f"tg:{user['id']}"


def display_name(user: dict) -> str:
    name = " ".join(p for p in [user.get("first_name"), user.get("last_name")] if p).strip()
    return name or user.get("username") or f"user{user.get('id')}"

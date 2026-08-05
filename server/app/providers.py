"""Обращения к внешним провайдерам входа: Telegram Bot API и Google.

Всё на stdlib (`urllib`) — новых зависимостей не тянем, как и в остальном бэкенде.
Сетевые вызовы вынесены в `_get_json`, чтобы тесты подменяли одну функцию и ходили
в сеть не приходилось.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request

from .auth import AuthError
from .config import GOOGLE_CLIENT_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME

GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

_bot_username_cache: str | None = None


def _get_json(url: str, timeout: int = 10) -> dict:
    """GET с разбором JSON. Ошибку сети превращаем в пустой ответ — решение
    принимает вызывающий (для нас «не подтвердилось» = отказ во входе)."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception:  # noqa: BLE001 — сеть/HTTP-код/битый JSON: одинаково «нет данных»
        return {}


def bot_username() -> str:
    """Имя бота для ссылки `t.me/<bot>?start=…`.

    Спрашиваем у самого Telegram (`getMe`) и кэшируем — так имя бота не нужно
    дублировать переменной окружения. TELEGRAM_BOT_USERNAME остаётся ручным
    переопределением на случай, если контейнер не ходит в api.telegram.org.
    """
    global _bot_username_cache
    if TELEGRAM_BOT_USERNAME:
        return TELEGRAM_BOT_USERNAME
    if _bot_username_cache:
        return _bot_username_cache
    if not TELEGRAM_BOT_TOKEN:
        return ""
    data = _get_json(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe")
    name = (data.get("result") or {}).get("username", "") if data.get("ok") else ""
    if name:
        _bot_username_cache = name  # неудачу не кэшируем — попробуем на следующем запросе
    return name


def verify_google_id_token(credential: str) -> dict:
    """Проверяет ID-токен Google и возвращает пользователя в нашем виде.

    Подпись проверяет сам Google — официальным эндпоинтом `tokeninfo` (так не нужен
    разбор RS256 и ключей JWKS вручную). Нам остаётся сверить, что токен выдан
    ИМЕННО нашему приложению (`aud`), нужным издателем, не истёк и почта подтверждена.
    """
    if not GOOGLE_CLIENT_ID:
        raise AuthError("Вход через Google не настроен")
    if not credential:
        raise AuthError("Пустой токен Google")

    claims = _get_json(f"{GOOGLE_TOKENINFO}?{urllib.parse.urlencode({'id_token': credential})}")
    if not claims or "sub" not in claims:
        raise AuthError("Google не подтвердил токен")
    if claims.get("aud") != GOOGLE_CLIENT_ID:
        raise AuthError("Токен выдан другому приложению")
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise AuthError("Неизвестный издатель токена")
    try:
        expired = int(claims.get("exp", 0)) <= int(time.time())
    except (TypeError, ValueError):
        expired = True
    if expired:
        raise AuthError("Токен Google истёк")
    if str(claims.get("email_verified", "")).lower() not in {"true", "1"}:
        raise AuthError("Почта Google не подтверждена")

    # Приводим к тому же виду, что и пользователь Telegram: дальше работают общие
    # workspace_for / display_name / user_fields.
    return {
        "id": claims["sub"],
        "first_name": claims.get("given_name"),
        "last_name": claims.get("family_name"),
        "username": claims.get("email"),
        "photo_url": claims.get("picture"),
    }

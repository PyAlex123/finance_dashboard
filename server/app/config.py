"""Настройки бэкенда из переменных окружения (и .env, если есть).

Тонкое хранилище: единственное, что нужно настроить, — адрес БД и разрешённые
источники CORS. Никакой бизнес-логики здесь нет.
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit

# Необязательная загрузка .env (python-dotenv). Без него берём системное окружение.
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:  # noqa: BLE001 — dotenv не обязателен
    pass


# По умолчанию — SQLite рядом с сервером: работает без установки СУБД.
# Для MySQL 8 (цель Фазы 4): mysql+pymysql://user:pass@host:3306/fin_reports
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./fin_reports.db")

# Источники для CORS. По умолчанию «*» — удобно для теста в локальной сети
# (запросы приходят с других устройств и портов). Cookie/креды не используем.
CORS_ORIGINS: list[str] = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
]

# Префикс пути, под которым обслуживается приложение (для размещения на подпути,
# напр. BASE_PATH=/dashboards → сайт на example.com/dashboards). Пусто — корень.
BASE_PATH: str = os.getenv("BASE_PATH", "").rstrip("/")

# Папка со статикой собранного фронта (в Docker-образе). Пусто — статику не отдаём
# (режим «только API», как раньше при отдельном web-контейнере).
STATIC_DIR: str = os.getenv("STATIC_DIR", "")

# --- Telegram Web App (Фаза 5) ---
# Токен бота от @BotFather. Пусто — вход через Telegram выключен (работает обычный
# вход по имени, пространство = имя в пути).
TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
# Имя бота без «@» — для ссылки t.me/<bot>?start=… на странице входа. Обычно
# определяется само через getMe; переменная нужна, только если контейнер не ходит
# в api.telegram.org.
TELEGRAM_BOT_USERNAME: str = os.getenv("TELEGRAM_BOT_USERNAME", "").strip().lstrip("@")
# Сколько живёт заявка на вход через бота (секунды).
LOGIN_REQUEST_TTL: int = int(os.getenv("LOGIN_REQUEST_TTL", "300"))
# Адрес нашего же API изнутри compose-сети — по нему бот подтверждает вход
# (сервис `app`, порт 8000; наружу не открыт). BASE_PATH добавляется автоматически.
INTERNAL_API_URL: str = os.getenv(
    "INTERNAL_API_URL", f"http://app:8000{BASE_PATH}"
).rstrip("/")

# --- Google OAuth (вход в браузере) ---
# Client ID веб-приложения из Google Cloud → APIs & Services → Credentials.
# Пусто — вход через Google выключен. Client secret не нужен: проверяем ID-токен.
GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "").strip()
# Секрет для подписи собственного JWT (HS256). В проде обязательно заменить.
JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
# Срок жизни выданного JWT.
JWT_TTL_SECONDS: int = int(os.getenv("JWT_TTL_SECONDS", str(7 * 24 * 3600)))
# Максимальный возраст initData (защита от повторного использования), сек.
TELEGRAM_INITDATA_MAX_AGE: int = int(os.getenv("TELEGRAM_INITDATA_MAX_AGE", str(24 * 3600)))
# Публичный URL Web App (для кнопок бота: /start и меню «Кабинет»). Напр.
# https://finlo.uz/. Пусто — бот не сможет собрать кнопки.
WEBAPP_URL: str = os.getenv("WEBAPP_URL", "").strip()


def _origin(url: str) -> str:
    """scheme://host из полного адреса (без пути) — основа для абсолютных ссылок."""
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else ""


# Публичный адрес сайта (origin) — нужен боту в ссылке входа: она открывается в
# браузере, поэтому должна быть абсолютной. По умолчанию берём из WEBAPP_URL,
# отбрасывая путь (BASE_PATH добавляется отдельно).
PUBLIC_URL: str = os.getenv("PUBLIC_URL", "").strip().rstrip("/") or _origin(WEBAPP_URL)

# Админы — по Telegram id (через запятую), напр. ADMIN_TG_IDS=12345,67890.
# Нормализуем в пространства tg:<id>. Пусто — админов нет.
def _parse_admins(raw: str) -> set[str]:
    out: set[str] = set()
    for part in raw.split(","):
        p = part.strip()
        if not p:
            continue
        out.add(p if p.startswith("tg:") else f"tg:{p}")
    return out


ADMIN_TG_IDS: set[str] = _parse_admins(os.getenv("ADMIN_TG_IDS", ""))

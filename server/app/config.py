"""Настройки бэкенда из переменных окружения (и .env, если есть).

Тонкое хранилище: единственное, что нужно настроить, — адрес БД и разрешённые
источники CORS. Никакой бизнес-логики здесь нет.
"""
from __future__ import annotations

import os
from pathlib import Path

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

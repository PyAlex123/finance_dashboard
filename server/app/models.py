"""Модель хранилища.

Один снимок данных (DataSnapshot фронтенда) на рабочее пространство. Тело храним
как текст — бэкенд его НЕ разбирает (принцип: весь расчёт на фронте, суммы bigint
едут тегированными). LONGTEXT/TEXT одинаково работает в SQLite и MySQL 8.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Snapshot(Base):
    __tablename__ = "snapshots"

    # Рабочее пространство = имя пользователя. Первичный ключ.
    workspace: Mapped[str] = mapped_column(String(190), primary_key=True)
    # Непрозрачный JSON снимка (с тегами $bigint). Сервер его не интерпретирует.
    data: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

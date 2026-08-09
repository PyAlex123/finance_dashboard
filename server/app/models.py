"""Модель хранилища.

Один снимок данных (DataSnapshot фронтенда) на рабочее пространство. Тело храним
как текст — бэкенд его НЕ разбирает (принцип: весь расчёт на фронте, суммы bigint
едут тегированными). LONGTEXT/TEXT одинаково работает в SQLite и MySQL 8.

Кроме снимков есть два лёгких реестра (тоже без разбора тела):
- `users` — регистрация пользователей Telegram (кто, когда, ник/фото);
- `reports` — индекс «отчётов»: у пользователя может быть несколько отчётов одного
  типа, тело каждого лежит в `snapshots` под ключом `reports.id`.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Snapshot(Base):
    __tablename__ = "snapshots"

    # Рабочее пространство = имя пользователя или ключ отчёта. Первичный ключ.
    workspace: Mapped[str] = mapped_column(String(190), primary_key=True)
    # Непрозрачный JSON снимка (с тегами $bigint). Сервер его не интерпретирует.
    data: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class User(Base):
    """Реестр пользователей. Запись создаётся/обновляется при каждом входе —
    «автоматическая регистрация». Фото не храним долго (URL Telegram протухают):
    держим последнее известное значение только для справки, в UI показываем свежее
    из initData каждой сессии."""

    __tablename__ = "users"

    # Ключ рабочего пространства: tg:<id> (Telegram) или g:<sub> (Google) — то же
    # значение, что возвращает workspace_for(user). Первичный ключ. Имя колонки
    # осталось историческим (сначала были только Telegram-пользователи).
    tg_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str | None] = mapped_column(String(190), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(190), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(190), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class BotAuthToken(Base):
    """Одноразовый токен входа с компьютера, выпущенный ботом.

    Пользователь пришёл в бота (`/start register`), бот попросил у API токен и дал
    ссылку `…/api/auth/telegram/consume?token=…`. Открытие ссылки в браузере — это и
    есть вход: запись помечается `used_at` и больше не работает. Живёт минуты
    (LOGIN_REQUEST_TTL), профиль записан сразу — токен именной."""

    __tablename__ = "bot_auth_tokens"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # Заполнено — ссылка уже использована, повторный переход отправляет на вход заново.
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    tg_id: Mapped[str] = mapped_column(String(64), nullable=False)
    username: Mapped[str | None] = mapped_column(String(190), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(190), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(190), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)


class Report(Base):
    """Индекс отчётов пользователя. Тело каждого отчёта — обычный снимок в `snapshots`
    под ключом = `Report.id`. Так «несколько отчётов внутри типа» переиспользуют всю
    существующую машинерию снимков без изменений."""

    __tablename__ = "reports"

    # Ключ снимка: owner:form:<rand>, напр. tg:12345:bs:k3n9. Первичный ключ.
    id: Mapped[str] = mapped_column(String(190), primary_key=True)
    # Владелец = рабочее пространство пользователя (tg:<id> или имя в LAN-режиме).
    owner: Mapped[str] = mapped_column(String(190), nullable=False, index=True)
    # Тип отчёта: 'cf' (ДДС), 'bs' (Баланс), 'pl' (P&L) — как ReportForm на фронте.
    form: Mapped[str] = mapped_column(String(8), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

"""Подключение к БД (SQLAlchemy). Одна абстракция на SQLite и MySQL 8."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

# check_same_thread нужен только для SQLite (несколько потоков uvicorn).
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_session():
    """Зависимость FastAPI: сессия на запрос."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

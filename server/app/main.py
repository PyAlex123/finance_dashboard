"""FastAPI-бэкенд (Фаза 4). Тонкое хранилище: CRUD снимка по рабочим пространствам.

Никакой бизнес-логики и никакого расчёта — весь движок на фронтенде. Тело снимка
хранится как непрозрачный JSON-текст (суммы bigint приходят тегированными).
"""
from __future__ import annotations

import json
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .config import CORS_ORIGINS
from .db import Base, engine, get_session


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Быстрый старт без Alembic (таблица одна). Для «настоящих» миграций —
    # `alembic upgrade head`; create_all идемпотентен и не мешает.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Fin Reports API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/workspaces")
def list_workspaces(db: Session = Depends(get_session)) -> list[dict]:
    """Список пространств — удобно видеть, кто что тестирует в сети."""
    rows = db.execute(
        select(models.Snapshot.workspace, models.Snapshot.updated_at).order_by(
            models.Snapshot.updated_at.desc()
        )
    ).all()
    return [{"workspace": w, "updatedAt": u.isoformat() if u else None} for w, u in rows]


@app.get("/api/snapshot/{workspace}")
def get_snapshot(workspace: str, db: Session = Depends(get_session)) -> dict:
    row = db.get(models.Snapshot, workspace)
    if row is None:
        raise HTTPException(status_code=404, detail="Пространство пустое")
    # data хранится текстом; отдаём распакованным внутрь конверта { data: ... }.
    return {"data": json.loads(row.data), "updatedAt": row.updated_at.isoformat()}


@app.put("/api/snapshot/{workspace}")
async def put_snapshot(
    workspace: str, request: Request, db: Session = Depends(get_session)
) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict) or "data" not in payload:
        raise HTTPException(status_code=422, detail="Ожидается тело { data: ... }")
    # Сериализуем непрозрачно: суммы уже тегированы фронтендом, сервер их не трогает.
    text = json.dumps(payload["data"], ensure_ascii=False, separators=(",", ":"))
    row = db.get(models.Snapshot, workspace)
    if row is None:
        db.add(models.Snapshot(workspace=workspace, data=text))
    else:
        row.data = text
    db.commit()
    return {"ok": True}


@app.delete("/api/snapshot/{workspace}")
def delete_snapshot(workspace: str, db: Session = Depends(get_session)) -> dict:
    row = db.get(models.Snapshot, workspace)
    if row is not None:
        db.delete(row)
        db.commit()
    return {"ok": True}

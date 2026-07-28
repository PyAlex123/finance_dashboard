"""FastAPI-бэкенд (Фаза 4). Тонкое хранилище: CRUD снимка по рабочим пространствам.

Никакой бизнес-логики и никакого расчёта — весь движок на фронтенде. Тело снимка
хранится как непрозрачный JSON-текст (суммы bigint приходят тегированными).
"""
from __future__ import annotations

import json
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .auth import (
    AuthError, display_name, jwt_decode, jwt_encode, user_fields, validate_init_data,
    workspace_for,
)
from .config import (
    BASE_PATH, CORS_ORIGINS, JWT_SECRET, JWT_TTL_SECONDS, STATIC_DIR,
    TELEGRAM_BOT_TOKEN, TELEGRAM_INITDATA_MAX_AGE,
)
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

# Все API-роуты под префиксом BASE_PATH/api (для размещения на подпути /dashboards).
# Пустой BASE_PATH → префикс /api, как раньше.
api = APIRouter(prefix=f"{BASE_PATH}/api")


@api.get("/health")
def health() -> dict:
    return {"status": "ok", "telegramAuth": bool(TELEGRAM_BOT_TOKEN)}


# ---------- Telegram Web App: вход по initData → свой JWT ----------

class TelegramAuthIn(BaseModel):
    initData: str


@api.post("/auth/telegram")
def auth_telegram(body: TelegramAuthIn, db: Session = Depends(get_session)) -> dict:
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram-логин не настроен на сервере")
    try:
        user = validate_init_data(body.initData, TELEGRAM_BOT_TOKEN, TELEGRAM_INITDATA_MAX_AGE)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    workspace = workspace_for(user)
    name = display_name(user)
    fields = user_fields(user)

    # Автоматическая регистрация: создаём/обновляем запись пользователя при каждом
    # входе (последний ник/имя/фото + last_seen). Тело отчётов тут не трогаем.
    row = db.get(models.User, workspace)
    if row is None:
        db.add(models.User(tg_id=workspace, **fields))
    else:
        row.username = fields["username"]
        row.first_name = fields["first_name"]
        row.last_name = fields["last_name"]
        row.photo_url = fields["photo_url"]
        row.last_seen = datetime.now(timezone.utc)
    db.commit()

    token = jwt_encode({"sub": workspace, "name": name}, JWT_SECRET, JWT_TTL_SECONDS)
    return {
        "token": token,
        "workspace": workspace,
        "name": name,
        "photoUrl": fields["photo_url"],
        "username": fields["username"],
    }


def require_workspace_access(workspace: str, authorization: str | None = Header(default=None)) -> None:
    """Пространства tg:* защищены JWT (когда включён Telegram-логин): токен обязан
    быть валиден, а пространство — принадлежать владельцу токена.

    Владельцу `tg:<id>` принадлежат как само пространство, так и все его под-ключи
    отчётов вида `tg:<id>:<form>:<rand>` (проверка по префиксу с двоеточием, чтобы
    `tg:1` не покрывал `tg:12345`). Обычные имена (не tg:) — открыты, как раньше
    (локальный режим/LAN)."""
    if not (TELEGRAM_BOT_TOKEN and workspace.startswith("tg:")):
        return
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Требуется вход через Telegram")
    try:
        payload = jwt_decode(token, JWT_SECRET)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    sub = payload.get("sub") or ""
    if workspace != sub and not workspace.startswith(f"{sub}:"):
        raise HTTPException(status_code=403, detail="Чужое рабочее пространство")


@api.get("/workspaces")
def list_workspaces(db: Session = Depends(get_session)) -> list[dict]:
    """Список пространств — удобно видеть, кто что тестирует в сети."""
    rows = db.execute(
        select(models.Snapshot.workspace, models.Snapshot.updated_at).order_by(
            models.Snapshot.updated_at.desc()
        )
    ).all()
    return [{"workspace": w, "updatedAt": u.isoformat() if u else None} for w, u in rows]


@api.get("/snapshot/{workspace}")
def get_snapshot(
    workspace: str,
    db: Session = Depends(get_session),
    _: None = Depends(require_workspace_access),
) -> dict:
    row = db.get(models.Snapshot, workspace)
    if row is None:
        raise HTTPException(status_code=404, detail="Пространство пустое")
    # data хранится текстом; отдаём распакованным внутрь конверта { data: ... }.
    return {"data": json.loads(row.data), "updatedAt": row.updated_at.isoformat()}


@api.put("/snapshot/{workspace}")
async def put_snapshot(
    workspace: str,
    request: Request,
    db: Session = Depends(get_session),
    _: None = Depends(require_workspace_access),
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


@api.delete("/snapshot/{workspace}")
def delete_snapshot(
    workspace: str,
    db: Session = Depends(get_session),
    _: None = Depends(require_workspace_access),
) -> dict:
    row = db.get(models.Snapshot, workspace)
    if row is not None:
        db.delete(row)
        db.commit()
    return {"ok": True}


# ---------- Реестр отчётов: несколько отчётов одного типа у пользователя ----------
# Тело каждого отчёта — обычный снимок в /snapshot/{id}. Здесь только индекс (мета).
# Доступ к чужим tg:*-владельцам закрыт тем же JWT-гвардом, что и снимки.

def _report_meta(r: models.Report) -> dict:
    return {
        "id": r.id,
        "owner": r.owner,
        "form": r.form,
        "name": r.name,
        "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
    }


class ReportCreateIn(BaseModel):
    owner: str
    form: str
    name: str


class ReportRenameIn(BaseModel):
    name: str


@api.get("/reports")
def list_reports(
    owner: str,
    form: str | None = None,
    db: Session = Depends(get_session),
    authorization: str | None = Header(default=None),
) -> list[dict]:
    require_workspace_access(owner, authorization)
    stmt = select(models.Report).where(models.Report.owner == owner)
    if form:
        stmt = stmt.where(models.Report.form == form)
    rows = db.execute(stmt.order_by(models.Report.created_at.asc())).scalars().all()
    return [_report_meta(r) for r in rows]


@api.post("/reports")
def create_report(
    body: ReportCreateIn,
    db: Session = Depends(get_session),
    authorization: str | None = Header(default=None),
) -> dict:
    require_workspace_access(body.owner, authorization)
    name = body.name.strip() or "Без названия"
    report_id = f"{body.owner}:{body.form}:{secrets.token_hex(4)}"
    row = models.Report(id=report_id, owner=body.owner, form=body.form, name=name)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _report_meta(row)


@api.patch("/reports/{report_id:path}")
def rename_report(
    report_id: str,
    body: ReportRenameIn,
    db: Session = Depends(get_session),
    authorization: str | None = Header(default=None),
) -> dict:
    require_workspace_access(report_id, authorization)
    row = db.get(models.Report, report_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    row.name = body.name.strip() or row.name
    db.commit()
    db.refresh(row)
    return _report_meta(row)


@api.delete("/reports/{report_id:path}")
def delete_report(
    report_id: str,
    db: Session = Depends(get_session),
    authorization: str | None = Header(default=None),
) -> dict:
    require_workspace_access(report_id, authorization)
    row = db.get(models.Report, report_id)
    if row is not None:
        db.delete(row)
    # тело отчёта (снимок) удаляем вместе с метой
    snap = db.get(models.Snapshot, report_id)
    if snap is not None:
        db.delete(snap)
    db.commit()
    return {"ok": True}


app.include_router(api)

# Статика собранного фронта под тем же префиксом (один контейнер: FastAPI отдаёт и
# SPA, и API). Монтируется ПОСЛЕ API-роутов, чтобы они имели приоритет. html=True —
# отдаёт index.html на запрос каталога. STATIC_DIR пуст → режим «только API».
if STATIC_DIR and os.path.isdir(STATIC_DIR):
    app.mount(BASE_PATH or "/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

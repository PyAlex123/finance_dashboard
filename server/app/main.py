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
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .auth import (
    AuthError, display_name, jwt_decode, jwt_encode, user_fields, validate_init_data,
    validate_login_widget, workspace_for,
)
from .config import (
    ADMIN_TG_IDS, BASE_PATH, CORS_ORIGINS, JWT_SECRET, JWT_TTL_SECONDS, STATIC_DIR,
    TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_INITDATA_MAX_AGE,
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


@app.middleware("http")
async def no_cache_html(request: Request, call_next):
    """SPA-оболочку (index.html) НЕ кэшируем: она ссылается на текущие хэши бандла,
    иначе Telegram/браузер держит старую страницу и грузит устаревший JS (карточки
    «Скоро», дизайн-система и т.п. «залипают»). Хэшированные ассеты (JS/CSS) —
    иммутабельны и кэшируются как обычно (их content-type не text/html)."""
    response = await call_next(request)
    if response.headers.get("content-type", "").startswith("text/html"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Все API-роуты под префиксом BASE_PATH/api (для размещения на подпути /dashboards).
# Пустой BASE_PATH → префикс /api, как раньше.
api = APIRouter(prefix=f"{BASE_PATH}/api")


@api.get("/health")
def health() -> dict:
    return {"status": "ok", "telegramAuth": bool(TELEGRAM_BOT_TOKEN)}


def is_admin(workspace: str) -> bool:
    """Пространство (tg:<id>) входит в список админов из ADMIN_TG_IDS."""
    return workspace in ADMIN_TG_IDS


# ---------- Telegram Web App: вход по initData → свой JWT ----------

class TelegramAuthIn(BaseModel):
    initData: str


@api.get("/config")
def public_config() -> dict:
    """Публичные настройки страницы входа: какой бот у кнопки Telegram и включён
    ли вход через Google. Отдаём в рантайме, чтобы смена бота не требовала
    пересборки фронта."""
    return {
        "telegramBot": TELEGRAM_BOT_USERNAME if TELEGRAM_BOT_TOKEN else "",
        "googleEnabled": False,
    }


@api.post("/auth/telegram")
def auth_telegram(body: TelegramAuthIn, db: Session = Depends(get_session)) -> dict:
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram-логин не настроен на сервере")
    try:
        user = validate_init_data(body.initData, TELEGRAM_BOT_TOKEN, TELEGRAM_INITDATA_MAX_AGE)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    return _issue_session(db, user)


@api.post("/auth/telegram-widget")
async def auth_telegram_widget(request: Request, db: Session = Depends(get_session)) -> dict:
    """Вход через Telegram Login Widget (обычный браузер, вне Web App).

    Тело — объект, который виджет отдал в data-onauth (id, auth_date, hash и
    поля профиля); состав полей задаёт Telegram, поэтому принимаем как есть и
    проверяем подпись по всему объекту.
    """
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram-логин не настроен на сервере")
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Ожидался объект с данными виджета")
    try:
        user = validate_login_widget(body, TELEGRAM_BOT_TOKEN, TELEGRAM_INITDATA_MAX_AGE)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    return _issue_session(db, user)


def _issue_session(db: Session, user: dict) -> dict:
    """Общий хвост обоих входов: регистрация/обновление пользователя и свой JWT."""
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
        "isAdmin": is_admin(workspace),
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


# ---------- Админ: список зарегистрированных пользователей ----------

def require_admin(authorization: str | None = Header(default=None)) -> str:
    """Пропускает только валидный JWT, чей sub входит в ADMIN_TG_IDS. Возвращает sub."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Требуется вход")
    try:
        payload = jwt_decode(token, JWT_SECRET)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    sub = payload.get("sub") or ""
    if not is_admin(sub):
        raise HTTPException(status_code=403, detail="Доступ только для администратора")
    return sub


@api.get("/admin/users")
def admin_users(
    db: Session = Depends(get_session),
    _: str = Depends(require_admin),
) -> dict:
    rows = db.execute(select(models.User).order_by(models.User.created_at.asc())).scalars().all()
    users = [
        {
            "tgId": u.tg_id,
            "username": u.username,
            "firstName": u.first_name,
            "lastName": u.last_name,
            "photoUrl": u.photo_url,
            "createdAt": u.created_at.isoformat() if u.created_at else None,
            "lastSeen": u.last_seen.isoformat() if u.last_seen else None,
        }
        for u in rows
    ]
    return {"count": len(users), "users": users}


app.include_router(api)

class SpaStaticFiles(StaticFiles):
    """Статика с SPA-fallback: несуществующий путь отдаёт index.html.

    Маршруты фронта настоящие (/login, /privacy, /terms, /app), а файлов под
    ними нет — без этого прямая ссылка и F5 давали бы 404. API-роуты сюда не
    попадают: они зарегистрированы до mount.
    """

    async def get_response(self, path: str, scope):  # noqa: ANN001 — сигнатура Starlette
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as e:
            # Starlette не возвращает 404, а бросает его — ловим и отдаём оболочку.
            if e.status_code != 404:
                raise
            return await super().get_response("index.html", scope)
        if response.status_code == 404:
            return await super().get_response("index.html", scope)
        return response


# Статика собранного фронта под тем же префиксом (один контейнер: FastAPI отдаёт и
# SPA, и API). Монтируется ПОСЛЕ API-роутов, чтобы они имели приоритет. html=True —
# отдаёт index.html на запрос каталога. STATIC_DIR пуст → режим «только API».
if STATIC_DIR and os.path.isdir(STATIC_DIR):
    app.mount(BASE_PATH or "/", SpaStaticFiles(directory=STATIC_DIR, html=True), name="static")

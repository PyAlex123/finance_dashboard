# Бэкенд (Фаза 4) — тонкое хранилище

FastAPI + SQLAlchemy + Alembic. Хранит **весь снимок данных** (`DataSnapshot`
фронтенда) по «рабочим пространствам» — одно пространство = один пользователь.
Никакой бизнес-логики: весь расчёт остаётся на фронтенде, суммы (bigint) сервер
не разбирает, а хранит как есть.

БД по умолчанию — **SQLite** (ничего ставить не нужно). Цель Фазы 4 — **MySQL 8**;
переключение — один параметр `DATABASE_URL` (см. ниже).

## Эндпоинты

| Метод  | Путь                        | Назначение                          |
|--------|-----------------------------|-------------------------------------|
| GET    | `/api/health`               | Проверка живости                    |
| GET    | `/api/workspaces`           | Список пространств (кто тестирует)   |
| GET    | `/api/snapshot/{имя}`       | Снимок пространства (404 — пусто)    |
| PUT    | `/api/snapshot/{имя}`       | Сохранить снимок (тело `{ data }`)  |
| DELETE | `/api/snapshot/{имя}`       | Очистить пространство               |

Документация Swagger — на `http://<адрес>:8000/docs`.

---

## Запуск (Windows PowerShell)

Из папки `server`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Создать таблицы (можно пропустить — сервер создаёт их сам при старте):
alembic upgrade head

# 0.0.0.0 — чтобы сервер был виден другим устройствам в сети:
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Проверка: открыть `http://localhost:8000/api/health` → `{"status":"ok"}`.

---

## Переключение на MySQL 8 (цель фазы)

1. Раскомментируйте в `requirements.txt` строки `pymysql` и `cryptography`, `pip install -r requirements.txt`.
2. Создайте БД: `CREATE DATABASE fin_reports CHARACTER SET utf8mb4;`
3. В `server/.env`:
   ```
   DATABASE_URL=mysql+pymysql://fin:fin@127.0.0.1:3306/fin_reports
   ```
4. `alembic upgrade head` и запуск как выше. Код приложения не меняется — только URL.

---

## Доступ другим людям в той же Wi-Fi сети

См. `../RUNNING.md` в корне проекта — там полный сценарий «сервер + фронтенд + телефоны коллег».

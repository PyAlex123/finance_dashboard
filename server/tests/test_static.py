"""Тесты отдачи фронта: SPA-fallback и его граница с API. Запуск (из папки server):
    ./.venv/Scripts/python.exe tests/test_static.py

Проверяем на временной папке со «сборкой» — настоящий dist не нужен.
"""
import os
import shutil
import tempfile

STATIC = tempfile.mkdtemp(prefix="finlo_static_")
with open(os.path.join(STATIC, "index.html"), "w", encoding="utf-8") as f:
    f.write("<!doctype html><title>SPA</title>")
os.makedirs(os.path.join(STATIC, "assets"), exist_ok=True)
with open(os.path.join(STATIC, "assets", "app.js"), "w", encoding="utf-8") as f:
    f.write("console.log(1)")

# окружение до импорта app.config/app.main
os.environ["STATIC_DIR"] = STATIC
os.environ["BASE_PATH"] = ""
os.environ["TELEGRAM_BOT_TOKEN"] = "123:TESTTOKEN"
os.environ["TELEGRAM_BOT_USERNAME"] = "testbot"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["WEBAPP_URL"] = "https://finlo.test/"
os.environ.setdefault("DATABASE_URL", "sqlite:///./_statictest.db")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402


def test_spa_routes_serve_index():
    """Прямая ссылка и F5 на маршруте фронта отдают оболочку, а не 404."""
    with TestClient(app) as c:
        for path in ["/", "/login", "/privacy", "/terms", "/app", "/что-угодно"]:
            r = c.get(path)
            assert r.status_code == 200, path
            assert "SPA" in r.text, path


def test_real_assets_served():
    with TestClient(app) as c:
        assert c.get("/assets/app.js").status_code == 200
        assert c.get("/assets/app.js").text == "console.log(1)"


def test_unknown_api_path_is_404_not_html():
    """Граница SPA-fallback: неизвестный /api/* обязан быть честным 404.

    Раньше он проваливался в index.html, и клиент получал HTML вместо ответа
    API — ошибка всплывала где-то дальше и выглядела необъяснимо.
    """
    with TestClient(app) as c:
        for path in ["/api/нет-такого", "/api/auth/tg-link/start", "/api"]:
            r = c.get(path)
            assert r.status_code == 404, f"{path} → {r.status_code}"
            assert "SPA" not in r.text, path


def test_known_api_still_works():
    with TestClient(app) as c:
        assert c.get("/api/health").json()["status"] == "ok"


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    try:
        for fn in fns:
            fn()
            print(f"  ok  {fn.__name__}")
        print(f"STATIC TESTS OK ({len(fns)})")
    finally:
        shutil.rmtree(STATIC, ignore_errors=True)

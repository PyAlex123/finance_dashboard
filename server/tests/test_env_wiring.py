"""Каждая задокументированная переменная окружения должна доезжать до контейнера.

Классическая тихая поломка: переменную описали в .env.docker.example, человек
задал её у себя в .env.docker — а в docker-compose.yml её не передали в сервис.
Приложение её не видит, ошибок нет, просто «не работает». Так пропала настройка
администратора: ADMIN_TG_IDS был в примере, но не в compose.

Запуск (из папки server):
    ./.venv/Scripts/python.exe tests/test_env_wiring.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXAMPLE = os.path.join(ROOT, ".env.docker.example")
COMPOSE = os.path.join(ROOT, "docker-compose.yml")


def documented_vars() -> list[str]:
    """Имена переменных из примера — без комментариев и пустых строк."""
    with open(EXAMPLE, encoding="utf-8") as f:
        return re.findall(r"^([A-Z][A-Z0-9_]*)=", f.read(), flags=re.M)


def compose_text() -> str:
    with open(COMPOSE, encoding="utf-8") as f:
        return f.read()


def test_example_is_not_empty():
    names = documented_vars()
    assert len(names) >= 8, f"подозрительно мало переменных в примере: {names}"


def test_every_documented_var_reaches_compose():
    """Переменная должна где-то использоваться в compose: в environment сервиса,
    в build args или в проброске портов."""
    text = compose_text()
    missing = [n for n in documented_vars() if f"${{{n}" not in text]
    assert not missing, (
        "переменные описаны в .env.docker.example, но не передаются в "
        f"docker-compose.yml: {missing}"
    )


def test_admin_ids_reach_app_service():
    """Отдельно проверяем настройку админа — на ней уже обжигались."""
    text = compose_text()
    assert "ADMIN_TG_IDS: ${ADMIN_TG_IDS" in text


def test_bot_service_gets_what_it_needs():
    """Боту нужны токен, адрес Web App, общий секрет и префикс пути — иначе он
    не соберёт ни кнопку, ни подписанный запрос к API."""
    text = compose_text()
    bot = text[text.index("  bot:"):]
    for name in ("TELEGRAM_BOT_TOKEN", "WEBAPP_URL", "JWT_SECRET", "BASE_PATH"):
        assert f"{name}: ${{{name}" in bot, f"сервису bot не передан {name}"


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"ENV WIRING TESTS OK ({len(fns)})")

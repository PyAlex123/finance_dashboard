# Бэкенд FastAPI. Драйвер MySQL (pymysql + cryptography) ставится поверх
# requirements.txt — образ рассчитан на MySQL 8 (цель Фазы 5). При старте
# применяются миграции Alembic, затем поднимается uvicorn.
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install -r requirements.txt pymysql cryptography

COPY . .
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]

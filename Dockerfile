# Единый образ (деплой на подпуть): Vite-сборка фронта + FastAPI, который отдаёт
# и статику SPA, и API, и хранит данные в SQLite. Один контейнер — «и бот, и БД».
#
# ARG VITE_BASE / VITE_API_URL задают подпуть на этапе сборки фронта
# (по умолчанию /dashboards). Бэкенд читает BASE_PATH из окружения в рантайме.

# --- сборка фронта ---
FROM node:20-alpine AS web
WORKDIR /web
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_BASE=/dashboards/
ARG VITE_API_URL=/dashboards
# VITE_BASE — через process.env для vite.config (base). VITE_API_URL — через
# .env.production (mode-specific, высший приоритет), чтобы значение гарантированно
# попало в import.meta.env клиента независимо от прочих .env.
ENV VITE_BASE=$VITE_BASE
RUN printf 'VITE_API_URL=%s\n' "$VITE_API_URL" > .env.production
RUN npm run build

# --- рантайм: FastAPI + статика + SQLite ---
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY server/requirements.txt .
RUN pip install -r requirements.txt
COPY server/ .
COPY --from=web /web/dist ./static
ENV STATIC_DIR=/app/static
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Фронтенд: сборка Vite → раздача статики nginx (SPA + прокси /api на бэкенд).
# VITE_API_URL по умолчанию "/" — фронт ходит на тот же origin, nginx проксирует
# /api на сервис api. Для кросс-доменного деплоя можно передать полный URL.

# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- serve ---
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

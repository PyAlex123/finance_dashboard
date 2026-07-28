import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // base — префикс путей ассетов. Для прод-подпути передаётся VITE_BASE=/dashboards/
  // (в Docker-сборке); локально по умолчанию корень "/", dev не ломается.
  base: process.env.VITE_BASE ?? '/',
  // host:true — сервер виден другим устройствам в сети без флага --host.
  // allowedHosts:true — не блокировать доступ по IP/имени с телефонов коллег.
  server: { host: true, port: 5173, allowedHosts: true },
  preview: { host: true, port: 5173, allowedHosts: true },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})

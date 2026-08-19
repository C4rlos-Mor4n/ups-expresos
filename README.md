# UPS Expresos

Repositorio principal del sistema UPS Expresos.

## Estructura

- `apps/api` — Backend NestJS + Prisma + PostgreSQL.
- `apps/mobile` — Aplicación Expo / React Native.

## Entornos

- `apps/api/.env.example` — variables de entorno del backend (plantilla segura).
- `apps/mobile/.env` — configuración del cliente mobile (`EXPO_PUBLIC_API_URL`).

> Los archivos `.env` reales no se versionan. Solo se mantiene `.env.example` con placeholders seguros.

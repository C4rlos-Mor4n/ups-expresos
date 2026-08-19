# Auditoría completa — UPS ExpresosApp API

Fecha: 2026-08-19
Alcance: `/ups-api` (NestJS 11 + Prisma 6 + PostgreSQL)
Estado de referencia: lint OK, typecheck OK, build OK, tests 95/95.

## ✅ Cambios aplicados (2026-08-19)

Críticos y limpieza resueltos:
- **Throttle reparado**: `app.module.ts` ahora lee `app.throttle` correctamente; se registran 2 throttlers (`default` = `THROTTLE_TTL/LIMIT`, `auth` = `THROTTLE_AUTH_TTL/LIMIT`). `THROTTLE_*` tienen efecto. Verificado: 3 req/min en auth, 4ª → 429.
- **Trust proxy configurable**: nueva var `TRUST_PROXY_HOPS` (default 0 = sin proxy); ya no es `trust proxy: true` ciego.
- **`@SkipThrottle({ auth: true })`** en los 10 controllers no-auth; `me`/`logout` exentos.
- **Races OTP corregidas**: `requestCode` usa upsert atómico sobre `email` único (sin P2002 ni usuario huérfano); `verifyCode` consume el código con `updateMany(usedAt: null)` (sin doble gasto).
- **`isActive` validado** en `verifyCode` y `refresh` (antes solo en `jwt.strategy`).
- **Rotación de refresh atómica** (`updateMany(revokedAt: null)`) → token reuse rechazado; sesión creada con `sessionId` pre-generado (sin patrón `pending-` ni sesiones huérfanas).
- **GlobalExceptionFilter** mapea Prisma `P2002→409`, `P2025→404`, `P2003→409`.
- **Código muerto eliminado**: `UsersModule/UsersService`, `ApiResponse<T>`, `TripFeedbackFiltersDto`, `scripts/verify-openapi.js`, `scripts/test-endpoints.js` (ngrok+creds), dep `swagger-ui-express`.
- **Build sin PII**: `tsconfig.build.json` excluye `prisma/` → `dist/prisma/seed-data.js` ya no se genera. `start:prod` → `node dist/main`.
- **OpenAPI regenerado** (`docs/handoff/ups-expresosapp-openapi.json`): 46 operaciones, sin ngrok/Render. Test `test:openapi` cableado en package.json.
- **Docs**: README/handoff corregidos (97 tests, 46 endpoints, admin 31, mobile 5, logout JWT, dominios). URLs ngrok/Render/staging eliminadas.
- **Prisma**: `prisma.config.ts` creado, deprecación `package.json#prisma` eliminada.

Estado final: lint OK, typecheck OK, build OK, **97 tests** (95 + 2 nuevos de `isActive`), openapi contract OK. Servidor prod arrancando y login/super-admin/OTP/SMTP verificado.

## 🔭 Follow-ups recomendados (no aplicados, requieren cambio mayor)

- Migrar generador Prisma de `prisma-client-js` → `prisma-client` (Prisma 7): cambia el API de imports del cliente en todo el app + tests. Hacer con cobertura completa.
- Consolidar los 8 DTOs paginados idénticos en un genérico `PaginatedResponseDto<T>` en `common/`.
- Eliminar los 3 pares Query/Filters duplicados (`schedule`, `mobile-route`, `trip-feedback`) y las 2 variantes de map de ruta.
- Centralizar el boilerplate de los 6 servicios CRUD + el audit-log repetido (base service / interceptor).
- Añadir throttle por email en `request-code` (por IP ya cubierto), índice `pg_trgm` para búsqueda mobile, purga de sesiones/OTP/audit, unique en schedules, validación cross-fecha en horarios y `@IsArray` en `OrderRouteStopsDto`.

## Veredicto

La base está bien organizada: módulos NestJS coherentes, DTOs consistentes, config centralizada en `src/config/`, schema Prisma ordenado. Los hallazgos son de bugs reales (throttling roto, races OTP), código muerto y documentación desactualizada.

## 🔴 Críticos

| # | Hallazgo | Ubicación |
|---|---|---|
| C1 | Rate limiting roto: el config se registra bajo la clave `app` (`registerAs('app')`) pero `configService.get('throttle')` busca una clave inexistente → siempre usa fallback `60000/10`. Las 4 vars `THROTTLE_*` no tienen efecto. | `src/app.module.ts:32`, `src/config/app.config.ts:51` |
| C2 | `trust proxy: true` confía en cualquier `X-Forwarded-For` → un atacante rota la cabecera y bypasea todo límite por IP. | `src/main.ts:26` |
| C3 | `POST /auth/verify-code` sin throttle propio (solo el global, inefectivo por C1) → fuerza bruta de OTP. | `src/modules/auth/auth.controller.ts:34` |
| C4 | Race en `requestCode`: `deleteMany`+`create` concurrentes → P2002 → 500. Además el `user.upsert` queda fuera de la transacción (usuario huérfano si falla). | `src/modules/auth/auth.service.ts:48-63` |
| C5 | Race en `verifyCode`: lectura y marcado de `usedAt` no atómicos → doble gasto del OTP (dos sesiones). | `src/modules/auth/auth.service.ts:77-124` |
| C6 | Usuarios `isActive=false` pueden obtener tokens: `verifyCode` y `refresh` no lo validan (solo `jwt.strategy.ts`). | `auth.service.ts:104-119,146-165` |

## 🟠 Altos

| # | Hallazgo | Ubicación |
|---|---|---|
| A1 | Throttle global 10 req/min para TODA la API (mobile carga rutas+stops+horarios → 429). | `src/app.module.ts:33-36` |
| A2 | Soft-delete inconsistente: schedules borran físicamente; el resto soft-delete. Stops inactivas aparecen en la app mobile. | `schedules.service.ts:104`, `mobile.service.ts:47-73` |
| A3 | Errores Prisma `P2002` → 500 en vez de 409 (no mapeados en el filter global). | `src/common/filters/http-exception.filter.ts` |
| A4 | `OrderRouteStopsDto.stops` sin `@IsArray()` → posible 500. | `src/modules/routes/dto/order-route-stops.dto.ts:30-35` |
| A5 | Audit logs tragan errores y no son transaccionales (se pierde el trail si muere el proceso). | `src/modules/audit-logs/audit-logs.service.ts:18-34` |
| A6 | Rotación de refresh con race: dos refrescos concurrentes crean dos sesiones (token reuse no detectado); sesión huérfana si falla `generateTokens`. | `auth.service.ts:215-240,146-168` |

## 🟡 Medios (orden/limpieza)

- Throttle de auth hardcodeado en `auth.controller.ts:25` en vez de usar `THROTTLE_AUTH_*`.
- Código muerto: `UsersService` (módulo sin consumidores), `ApiResponse<T>` (`common/types/api-response.type.ts`), `TripFeedbackFiltersDto`, `openapi-contract.spec.ts` (test que ningún runner ejecuta), `scripts/verify-openapi.js` y `scripts/test-endpoints.js` (huérfanos, con URL ngrok).
- Duplicación: 8 DTOs paginados idénticos, 3 pares Query/Filters idénticos, 6 servicios CRUD con el mismo boilerplate, audit-log manual en 8 servicios, `mapRouteToResponse` duplicado.
- Deprecaciones Prisma 7: `package.json#prisma.seed` y `provider = "prisma-client-js"`.
- PII en el build: emails personales reales en `seed.ts`/`seed-data.ts` que se compilan a `dist/` (no excluidos en `tsconfig.build.json`).
- `.env.test` referenciado en `setup-e2e.ts:4` pero inexistente.

## 🟢 Bajos

- URLs legacy ngrok/Render en `scripts/test-endpoints.js`, `docs/handoff/ups-expresosapp-openapi.json` (además le faltan los 5 DELETE), `ROUTES_DETAILED_FRONTEND_MOBILE.md`, `SWAGGER_AND_ROUTES_AUDIT_2026-07-09.md`.
- 3 configs de Postgres distintas: `.env` real (5432/krionix), `.env.example`+README (5433), `test:e2e` (5434).
- README con cifras desincronizadas (40 vs 46 endpoints, 92 vs 101 tests).
- Deps sobrantes: `swagger-ui-express` sin importar; aliases de path configurados y nunca usados; `@types/passport`/`@types/express` solo transitivas.
- Validación débil de secrets JWT (`min(1)`), `NODE_ENV` default `development`, sesiones/OTP/audit sin purga, duplicados de schedules permitidos por API, asignación de vehículo/ruta no exclusiva, búsqueda mobile `ILIKE %...%` sin índice, `verify-code`/`refresh` devuelven 201, `logout` exige access token, DevMailProvider no loguea el código, CORS wildcard sin validar.
# Panel administrativo web de UPS GO

`apps/web` — Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4. Se sirve bajo **`/panel`**.
Permite operar el transporte sin scripts ni acceso a la base de datos.

## Arquitectura

```text
Navegador ──► gateway (Caddy) ──/panel──► web (Next.js, BFF) ──► API NestJS ──► PostgreSQL
                     └──────────── resto ─────────────────────► API (app móvil, webhook Hunter)
```

- **La web nunca toca Prisma/PostgreSQL**: todo pasa por la API, que valida roles en cada endpoint.
- **BFF con cookies httpOnly** (`src/lib/server/session.ts`): el login OTP lo hacen los route handlers
  `/panel/api/auth/{request-code,verify,logout}`; los tokens se guardan en cookies `HttpOnly`, `SameSite=Lax`,
  `Secure` bajo HTTPS y `path=/panel`. El navegador nunca ve los tokens (nada en `localStorage`).
- **Proxy restringido** `/panel/api/proxy/*`: reenvía a la API con el token del administrador y renueva el access
  token con el refresh si venció. Solo permite rutas `admin/*` y `auth/me` (`guards.ts`, con test).
- **CSRF**: además de `SameSite`, toda mutación exige `Origin` igual al host del panel.
- **Solo ADMIN/SUPER_ADMIN**: si una cuenta sin esos roles verifica el código, el BFF cierra la sesión y responde 403.
- `src/proxy.ts` (antes "middleware") redirige a `/panel/login` si no hay sesión.
- IP real hacia la API: el BFF envía la IP pública más a la derecha de `X-Forwarded-For` para que el rate limiting
  de la API sea por administrador y no por contenedor.
- Datos: SWR (refresco automático en Monitoreo, Resumen y GPS). Componentes propios en `src/components/ui.tsx`
  con la identidad de la app (navy, azul UPS, dorado; fuente Inter).

## Módulos

| Sección | Qué permite | API |
|---|---|---|
| Resumen | Salidas del día, salidas sin bus, recorridos en curso, buses con GPS en vivo, GPS sin vincular, alertas 24 h. | `GET /admin/dashboard` |
| Monitoreo en vivo | Mapa (Leaflet/OSM) con la flota, estado de cada bus, recorrido en curso, alertas. Refresco 10 s. | `/admin/tracking/fleet`, `/alerts` |
| Salidas y asignaciones | Por línea, fecha y sentido: ver salidas, asignar 1..N buses (bus + conductor + recorrido), cancelar asignaciones no iniciadas. Conflictos de horario con mensaje claro. | `/admin/operational/service-lines/:id/timetable`, `POST service-assignments`, `POST service-assignments/:id/cancel` |
| Horarios | Calendarios por línea (vigencia, estado), publicar/archivar (la API valida la publicación), ver horas por sentido y días, **generar salidas** (materialización idempotente). | `/admin/schedules/*` |
| Paradas | Alta/edición con coordenadas y la referencia que ve el estudiante. | `/admin/stops` |
| Buses | Alta/edición, estado (activo, mantenimiento, inactivo). | `/admin/vehicles` |
| Conductores | Alta/edición y **acceso a la app** (vincular/quitar correo; quitar revoca la sesión). | `/admin/drivers`, `/:id/account` |
| GPS (Hunter) | Equipos que reportan, último reporte, ubicación, vincular a un bus, habilitar/deshabilitar. | `/admin/tracking/devices` |
| Usuarios | Buscar, filtrar por rol, desactivar/reactivar (revoca sesiones), cambiar rol. Solo SUPER_ADMIN gestiona administradores; nadie se modifica a sí mismo; el rol conductor se gestiona desde Conductores. | `/admin/users` |
| Auditoría | Quién hizo qué y cuándo (incluye acciones automáticas del sistema). | `/admin/audit-logs` |

**No incluido todavía** (la API no tiene endpoints o es una fase posterior): edición de campus, líneas y recorridos
(RoutePaths); editor visual de patrones/horas/tiempos por parada (hoy se cargan con la API `/admin/schedules/*` o el
dataset de referencia); excepciones (feriados) desde la UI; trayecto histórico en el mapa.

## Desarrollo

```bash
cd apps/web
pnpm install
API_INTERNAL_URL=http://localhost:3000 pnpm dev      # http://localhost:3001/panel
pnpm verify                                          # typecheck + tests (vitest) + build
```

Para ingresar se necesita una cuenta `ADMIN` o `SUPER_ADMIN` (los correos de `SUPER_ADMIN_EMAILS` reciben ese rol).

## Despliegue

`docker-compose.yml` agrega `web` (imagen `apps/web/Dockerfile`, Next standalone) y `gateway`
(`deploy/gateway`, Caddy). El túnel ngrok (o el dominio) apunta al **gateway**: la app móvil sigue usando la misma
URL base y el panel queda en `https://<dominio>/panel`. Con gateway + ngrok la API debe usar `TRUST_PROXY_HOPS=2`.

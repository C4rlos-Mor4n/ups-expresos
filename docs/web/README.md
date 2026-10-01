# Panel administrativo web de UPS GO

> **Estado: no existe todavía.** No hay `apps/web`. Este documento fija las decisiones, el alcance y las reglas
> para cuando se construya, de modo que el panel nazca alineado con la API ya implementada.

## Objetivo

Operar y configurar el sistema **sin** seeds, scripts, Prisma Studio ni acceso directo a PostgreSQL:
campus, líneas, recorridos, paradas, horarios, buses, conductores, salidas, asignaciones, usuarios y auditoría.

## Stack decidido

| Capa | Decisión |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript |
| UI | Tailwind CSS + shadcn/ui, diseño *desktop-first* y accesible |
| Paquetes | pnpm, paquete independiente en `apps/web` |
| Contrato | Cliente generado desde el **mismo OpenAPI** (en `apps/web/src/generated`), sin importar código de `apps/mobile` |
| Datos del servidor | `fetch` en Server Components; TanStack Query para tablas interactivas y mutaciones |
| Formularios | React Hook Form + Zod (el DTO/OpenAPI sigue siendo la fuente de verdad) |
| Tablas | TanStack Table con paginación/filtros del lado del servidor |

## Reglas

1. **La web nunca se conecta a Prisma/PostgreSQL.** Browser → Web → API NestJS → Prisma → PostgreSQL.
2. **Una sola identidad:** el mismo flujo OTP. No se crea login/contraseña paralelo ni se recrea `AllowedEmailDomain`.
3. **Tokens:** evitar refresh tokens en `localStorage`. Recomendado un BFF de Next.js con cookies `HttpOnly`, `Secure`,
   `SameSite` y protección CSRF en mutaciones; CORS explícito (`CORS_ORIGINS`) sin comodines con credenciales.
4. **Roles:** `ADMIN` y `SUPER_ADMIN`. Usuarios y auditoría solo `SUPER_ADMIN`. El frontend oculta, el backend decide.
5. **Workflows de negocio, no CRUD 1:1 de tablas** (especialmente horarios). La web configura; la API valida, publica y materializa.
6. **No reimplementar lógica de calendario ni el estado agregado** de una salida en el cliente.
7. **Multibus:** una salida tiene 0..N asignaciones; jamás un único `busId`.
8. **Desactivar o archivar** entidades con historia operativa; no borrado físico. Confirmación en acciones de impacto.
9. **El solape de bus/conductor** lo previene la UI, pero la restricción de base de datos es la defensa final: muestra el 409 con un mensaje claro.
10. Sin GPS/ETA hasta que exista el flujo de tracking ([`../api/tracking-hunter.md`](../api/tracking-hunter.md)).

## Módulos previstos

```text
Dashboard (solo KPIs reales)
Operación:       Salidas, Asignaciones, Operación del día
Transporte:      Campus, Líneas, Recorridos, Paradas, Horarios, Excepciones
Recursos:        Buses, Conductores
Administración:  Usuarios, Auditoría          (SUPER_ADMIN)
Futuro:          Monitoreo en vivo
```

## Qué ya tiene la API y qué falta

| Módulo | API hoy |
|---|---|
| Paradas, buses, conductores | CRUD listo (`/admin/stops|vehicles|drivers`). Faltan búsqueda/filtros y vincular `Driver.userId`. |
| Horarios y excepciones | Listo (25 operaciones `/admin/schedules`), incluida materialización. |
| Campus / líneas | Solo lectura. Faltan CRUD y gestión de campus atendidos. |
| Recorridos (RoutePath) | Solo visibles dentro del timetable. Falta CRUD y ordenamiento de paradas. |
| Asignaciones | Crear y listar. Faltan actualizar, cancelar, liberar y verificar disponibilidad. |
| Operación del día / dashboard | Faltan endpoints agregados. |
| Usuarios | No existe (solo `/auth/me`). |
| Auditoría | Se escribe; falta endpoint de lectura. |

Pendiente de seguridad antes de exponer cambios de rol: el rol viaja en el access token (15 min); ver
[`../api/conventions.md`](../api/conventions.md#límite-conocido).

## Roadmap sugerido

1. **Foundation:** `apps/web`, Next.js, cliente OpenAPI, layout con barra lateral, estados de carga/vacío/error, CI.
2. **Auth y RBAC:** OTP, sesión segura, protección de rutas.
3. **Catálogos:** campus, líneas (propietario y atendidos), paradas, recorridos.
4. **Horarios:** calendarios, días, horas, recorridos con offsets, excepciones, publicación y materialización.
5. **Recursos y operación:** buses, conductores, salidas, asignaciones multibus, operación del día.
6. **Usuarios y auditoría**, tablero con KPIs reales.
7. **Endurecimiento y QA integral**, E2E de navegador, cierre.

Cada fase se acompaña de los endpoints backend que le falten (con DTOs, OpenAPI, pruebas de roles y de conflicto).

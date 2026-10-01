# Historial de fases

Informes, revisiones y diseños producidos durante la construcción de UPS GO
(fases 1 a 8). Se conservan porque explican **por qué** se tomaron ciertas
decisiones de dominio, pero son instantáneas: pueden estar desactualizadas.

> Ante cualquier conflicto, prevalecen el código en `main`, el esquema de Prisma,
> el contrato OpenAPI generado y las guías vigentes en `docs/api` y `docs/app`.

Ejemplos de contenido desactualizado que se debe ignorar:

- Menciones a `Route`, `Trip`, `Notice`, `RouteAssignment` y `TripFeedback`: dominio retirado.
- La tabla `AllowedEmailDomain` y variables `THROTTLE_AUTH_*`: eliminadas.
- Nombres antiguos de producto ("UPS ExpresosApp", "BUSES APP").

Documentos especialmente útiles para entender el dominio:

- `PHASE_5B_CALENDAR_SCHEDULE_DOMAIN_DESIGN.md` — modelo de calendarios y horarios.
- `PHASE_5C_OPERATIONAL_DOMAIN_DESIGN.md` — salidas, asignaciones y ejecuciones.
- `PHASE_6_FRONTEND_API_CONTRACT.md` y `PHASE_7_MOBILE_FLOW_CONTRACT.md` — contratos y flujos.
- `PHASE_8B_ADMIN_SCHEDULE_MANAGEMENT_API.md` — API administrativa de horarios.

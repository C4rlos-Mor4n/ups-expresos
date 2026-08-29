# Phase 8 — Legacy/dead-code gate

La fase clasifica los componentes de transporte previos así:

| Clasificación | Decisión |
|---|---|
| ACTIVE | Dominio operacional nuevo, endpoints Student/Driver/Admin y cliente móvil UPS GO. |
| COMPATIBILITY | Ningún adapter temporal de transporte queda activo en el flujo móvil. |
| DEAD | Modelos Prisma, módulos, endpoints, DTOs, tests y seeds del dominio legacy sin consumidores; se retiran en una migración controlada y destructiva de decommission, junto con el mismo cambio de código. |

La evidencia de consumidores se revisa mediante búsquedas de imports, schema,
OpenAPI generado y suites de integración. No se conserva código comentado ni
un fallback a rutas o viajes legacy.

La migración se prueba desde una base PostgreSQL vacía con
`prisma migrate deploy`; no se usa `prisma db push` ni se alteran migraciones
ya aplicadas. Los `DROP` son aceptables solo en preproducción después de
demostrar cero consumidores y reproducción desde cero.

# UPS GO — Phase 8 external review

## Verdict

**PASS local / GO Git Closure.** No hay hallazgos abiertos Critical, High ni
Medium. El merge permanece condicionado a PR CI y Main CI.

## Scope

- Canonical worktree: `/home/cmoran/ups-expresos-phase-8-pre-release`.
- Canonical branch: `feature/phase-8-pre-release-hardening`.
- Baseline reviewed: `88473f74ea8ba4b27c0b95c15d8861cf43373861`.
- Fuera de alcance: Admin Web, GPS, realtime y ETA.

## Git diff

Se revisó el diff completo: decommission legacy, dominio operacional,
contrato generado, seed demo, dev-stack, identidad UPS GO y documentación.
`git diff --check` no reportó errores. No hay APK, export, `.env`, dump ni
metadatos de worktree en el candidato.

## Legacy removal

Las búsquedas en API, Mobile, scripts, workflows y schema reportaron cero
consumidores runtime, cero consumidores Mobile, cero scripts requeridos y cero
rutas públicas activas para `Route`, `Schedule`, `Trip`, `Notice`,
`RouteAssignment` y `TripFeedback`.

El dominio activo es:

```text
Campus → ServiceLine → ServiceCalendar → SchedulePattern → ScheduleTime
       → ScheduleJourneyTemplate → ScheduledDeparture
       → ServiceAssignment → ServiceRun
```

Se retiraron handoffs estáticos que describían el API legacy. Los informes
fechados solo se conservan como evidencia histórica. El JSON
`docs/ups_go_routes_reference_guayaquil.json` está presente y no resucita
schema legacy.

## Migration

`20260829154419_decommission_legacy_transport_domain` es una migración
**destructiva**, no aditiva. Elimina constraints e índices legacy, las columnas
`drivers.assignedRouteId` y `drivers.assignedVehicleId`, las tablas `notices`,
`route_assignments`, `route_stops`, `routes`, `schedules`, `trip_feedbacks` y
`trips`, y los enums `DayOfWeek`, `NoticeSeverity`, `RouteStatus`,
`ScheduleStatus` y `TripStatus`.

Es aceptable solo en preproducción: se confirmó cero consumidores y la cadena
se reprodujo desde PostgreSQL 17 vacío. No se modificaron migraciones
históricas ni se usó `prisma db push`.

## Fresh PostgreSQL

En PostgreSQL 17 descartable pasaron `prisma validate`, `prisma generate`,
`prisma migrate deploy` y `prisma migrate status`. Se aplicaron exactamente
siete migraciones y el schema quedó current.

| Gate | Tests |
|---|---:|
| CalendarResolver | 1 |
| ScheduledDeparture | 1 |
| Materializer | 10 |
| Operational domain | 5 |
| Operational API / RBAC | 3 |
| Total | 20 |

## Demo seed

`pnpm prisma:reset:demo` se ejecutó dos veces sobre la base fresca. El segundo
reset fue determinista y no duplicó datos. El cleanup requiere
`UPS_GO_DEMO_CONFIRM=DELETE`, elimina únicamente identificadores `UPS-GO-DEMO`
y falla con `NODE_ENV=production`.

```text
users:        3
drivers:      1
vehicles:     1
departures:   2
assignments:  1
serviceRuns:  0
```

| Cuenta | Rol | Resultado |
|---|---|---|
| `carlitosmoran245@gmail.com` | `SUPER_ADMIN` | PASS |
| `carlosmoran.v28@gmail.com` | `DRIVER` | PASS |
| `carlosmoranvasquez26@gmail.com` | `STUDENT` | PASS |

`User → Driver` existe para la cuenta Driver y la asignación primaria queda en
`ASSIGNED`, sin `ServiceRun`.

## Student, Driver and cross-role QA

La evidencia nativa revisada contra backend real confirma Student consultando
Campus María Auxiliadora y Ruta Norte, la salida 06:40 en `ASSIGNED`, luego la
misma asignación en `IN_PROGRESS` y finalmente en `COMPLETED`. Driver visualiza
su asignación propia, inicia y finaliza su recorrido. La reapertura de la app
restauró un recorrido vigente: **current-run restore PASS**.

La integración API reforzada prueba que Student no accede a Driver API, Driver
no accede a Student API y otro Driver no opera una asignación ajena.

## Auth/RBAC

`JwtAuthGuard` y `RolesGuard` son globales y los controladores Student/Driver
declaran roles explícitos. Mobile bloquea deep links cruzados; sólo `STUDENT` y
`DRIVER` llegan a sus espacios. `ADMIN` y `SUPER_ADMIN` terminan en
`/unsupported-role`. El backend continúa como autoridad.

## OpenAPI contracts

```text
DTO NestJS → OpenAPI → apps/mobile/src/api/generated/openapi.ts
```

`pnpm test:openapi` y `pnpm verify:mobile-contracts` pasan. Driver incluye
`ServiceLine.description` en backend, OpenAPI y Mobile. El endpoint nullable
`GET /driver/operational/service-runs/current` responde ahora
`application/json` con cuerpo literal `null`; integración comprueba ambos y
Mobile rechaza payloads no nulos malformados.

## Type safety

La búsqueda en producción de API, Mobile y seed reportó:

```text
explicit any:                 0
unsafe double casts:          0
Record<string, any>:          0
Promise<any> / any[]:         0
ts-ignore / ts-expect-error:  0
```

El código generado fue revisado por separado y tampoco contiene esas formas.

## dev-stack

`bash -n scripts/dev-stack.sh` pasa. El script vincula API/Metro al checkout,
detecta listeners de otro checkout y exige `--takeover`; `--stop` sigue sólo la
cadena conocida. Configura `adb reverse`, usa `exp+ups-go` y documenta
`--rebuild`, `--reuse-installed` y `--stop`.

El smoke definitivo debe ejecutarse desde `~/ups-expresos` después del merge y
la consolidación.

## Mobile and APK

```text
npm ci                         PASS
npm run verify                 PASS (9 suites, 48 tests)
Expo Android export            PASS
Expo iOS export                PASS
APK inspection                 PASS
```

```text
label:       UPS GO
package:     ec.edu.ups.expresos
version:     1.0.1
```

No APK ni export generado está en el diff.

## CI

El workflow no contiene `continue-on-error` ni `|| true` para gates. API CI
ejecuta Prisma, las 20 integraciones PostgreSQL, lint, typecheck, build, Jest,
OpenAPI y drift generado. Mobile CI ejecuta `npm ci`, verify y export Android
con Node 20 y pnpm 10.34.5.

## Findings and fixes

| Severity | Finding | Resolution |
|---|---|---|
| MEDIUM | Nullable endpoint devolvía 200 vacío. | API devuelve JSON `null` y tiene regresión HTTP. |
| MEDIUM | README y handoffs describían contratos legacy. | Se retiraron y se dejó contrato generado como fuente de verdad. |
| MEDIUM | Faltaba cobertura explícita de aislamiento Student/Driver y SUPER_ADMIN móvil. | Se añadieron regresiones API y Mobile. |
| LOW | `npm audit` informa 20 advisories heredados. | Sin uso de producción explotable: 17 Expo/Metro/build, 2 ESLint/Jest y 1 `nanoid` sin import directo ni generador custom. No se ejecutó `npm audit fix --force`. |

## Remaining risks

Las 20 alertas npm requieren actualización coordinada de Expo SDK, no un fix
forzado durante este pre-release. La certificación remota y consolidación de
worktrees quedan pendientes al redactar este documento.

## Git decision

```text
CRITICAL open: 0
HIGH open:     0
MEDIUM open:   0

GO commit/push/PR: YES
GO merge:          only after PR CI PASS
```

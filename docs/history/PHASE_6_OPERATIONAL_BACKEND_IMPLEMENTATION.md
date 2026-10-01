# UPS GO — Phase 6 Operational Backend Implementation

## Verdict

Local BUILD complete pending final independent review. No commit, push, PR or merge was performed.

## Baseline and architecture

Baseline: `37f9ede33c650ec709326f4a142ddf8ac19d3020`.

`ScheduledDeparture` is still a planned timetable fact. `ServiceAssignment` selects one active vehicle, driver and JourneyTemplate for that fact. `ServiceRun` is the sole evidence that an assigned bus is actually operating.

## Prisma and migration

Migration `20260829131406_add_operational_backend` adds `ServiceAssignment`, `ServiceRun`, two small enums, indexed restrictive foreign keys and PostgreSQL `btree_gist` exclusion constraints. Vehicle and driver overlap are protected by half-open UTC ranges. No legacy table was changed or removed.

Planned windows use the civil Ecuador date plus scheduled `TIME` and the JourneyTemplate final stop offset. They are persisted as UTC `TIMESTAMPTZ`; a route without a positive final offset is rejected. The test matrix runs under UTC, America/Guayaquil and Asia/Tokyo.

## Operations and security

Assignment creation validates active resources and exact JourneyTemplate ownership. The exclusion constraints are the final concurrent-write guard. ServiceRun start uses ordered transaction-scoped PostgreSQL advisory locks for assignment, driver and vehicle; its one-to-one FK is the final guard for four concurrent starts. Finish uses a conditional state update and is idempotent.

Student endpoints are product-oriented and do not expose driver phone, email or user IDs. Driver endpoints resolve ownership solely through `Driver.userId`. Admin endpoints require ADMIN or SUPER_ADMIN.

## Assignment invariants and planned windows

An assignment is only valid when its `JourneyTemplate` belongs to the departure's exact `sourceScheduleTimeId`, and the template route path has the same service line and direction as the `ScheduledDeparture`. Vehicle and driver must be active. The persisted interval is derived—not supplied by the caller—from `serviceDate`, scheduled `TIME`, Ecuador civil time and the final JourneyTemplate stop offset.

The interval is stored as `[plannedStartAt, plannedEndAt)`: a departure ending at 08:00 may therefore use the same vehicle or driver for one beginning at 08:00. Dates are calculated without relying on the host process timezone.

## Concurrency and ServiceRun lifecycle

Assignment writes are guarded both before insert and by PostgreSQL partial exclusion constraints, so only `ASSIGNED` reservations block resource overlap. ServiceRun start serializes assignment, driver and vehicle with deterministic transaction-scoped advisory locks; it then rechecks state and creates the one permitted run. Finish transitions only `IN_PROGRESS` to `COMPLETED`, and retrying either operation returns the existing stable resource.

## API surface

Student receives campus, service line, concrete departure and service-state views. Driver receives only their own assignments, can start them, inspect the current run and finish it. Admin receives catalog reads, timetable resolution, assignment creation and paginated operational reporting. The API contract document records request/response shapes and explicitly marks internal report-oriented routes as non-public.

## Legacy compatibility

`Schedule`, `RouteAssignment`, `Trip`, `currentOperation` and current `/mobile` routes are ACTIVE/COMPATIBILITY and untouched. New endpoints have no legacy read fallback. No legacy deletion occurred.

## DEV/QA dataset and CI

`pnpm prisma:seed:phase6:qa` is explicit, blocked in production and prefixes all objects with `DEVQA-P6`. It materializes through the production resolver/materializer, is idempotent and creates Ruta Norte IDA/RETORNO, three buses and one active run. Cleanup requires `PHASE6_QA_MODE=cleanup PHASE6_QA_CONFIRM=DELETE`.

CI keeps one `API Quality Gate` and adds hard-fail Phase 6 PostgreSQL domain and API steps. New reports and the frontend contract are the handoff for Phase 7.

## Validation evidence

On a recreated, empty PostgreSQL 17 database, all six migrations deployed and status was current. Prisma format, validation and generation passed; lint, TypeScript typecheck, production build and OpenAPI contract passed. Legacy calendar/departure/materializer PostgreSQL integrations passed `1 + 1 + 10`; Phase 6 operational and HTTP integrations passed `5 + 3`; global Jest passed `182` tests with `20` intentionally opt-in skips. The timezone helper passed under `UTC`, `America/Guayaquil` and `Asia/Tokyo`.

## Risks and next step

No assignment cancellation endpoint or run telemetry/GPS is introduced; this is intentional Phase 7+ scope. The operational model does not change Student mobile, legacy APIs or legacy records. The next allowed step is independent build review; commit, push, PR and merge remain forbidden.

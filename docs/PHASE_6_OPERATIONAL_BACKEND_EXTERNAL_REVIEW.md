# UPS GO — Phase 6 Operational Backend External Review

## Verdict

PASS. The reviewed local candidate remains additive, compatible with the approved Phase 6 design and has no open CRITICAL, HIGH or MEDIUM finding. Git closure is authorized subject to the candidate audit and remote CI gates.

## Scope

Reviewed worktree: `feature/phase-6-operational-backend`, based on `37f9ede33c650ec709326f4a142ddf8ac19d3020`. Scope is the operational backend only: ServiceAssignment, ServiceRun, Student/Driver/Admin operational APIs, DEV/QA data, CI and documentation. Mobile, Admin Web, GPS and realtime are out of scope.

## Schema

`ServiceAssignment` is a planned allocation from one `ScheduledDeparture` to one vehicle, driver and JourneyTemplate. `ServiceRun` is a one-to-one operational fact. New relations are additive. Existing Schedule, RouteAssignment, Trip and the legacy mobile operation shape are semantically unchanged.

## Migration

`20260829131406_add_operational_backend` creates only new enums, tables, indexes, restrictive FKs, one positive-window check and two exclusion constraints. It contains no DROP, TRUNCATE, DELETE, mass UPDATE or legacy destructive alteration. All operational FKs use `ON DELETE RESTRICT`.

## Assignment Domain

Creation accepts only resource IDs. It validates active vehicle/driver status and requires the JourneyTemplate to belong to the exact departure source ScheduleTime, service line and direction. Planned timestamps are calculated server-side and cannot be caller supplied.

## Overlap Constraints

PostgreSQL `btree_gist` supports partial exclusion constraints for ASSIGNED vehicle and driver reservations over `[plannedStartAt, plannedEndAt)`. The integration test demonstrates rejected overlapping vehicle/driver allocations, a race with at most one persisted assignment, and an accepted exact 07:30 handoff after a 06:40–07:30 allocation.

## Planned Windows

The window is Ecuador civil `serviceDate` plus scheduled TIME and the positive final stop offset, persisted as UTC `TIMESTAMPTZ`. A zero or invalid final offset is rejected. A 23:50 departure with 30 minutes ends at 00:20 on the next civil day.

## Timezone

The date helpers use UTC calendar arithmetic plus the stable America/Guayaquil offset rather than process-local time. Focal tests passed under UTC, America/Guayaquil and Asia/Tokyo with identical assertions.

## ServiceRun

The unique `serviceAssignmentId` is the database-level maximum-one-run guard. Start creates only IN_PROGRESS and returns the already in-progress run idempotently. Finish conditionally transitions IN_PROGRESS to COMPLETED; retries return completed state and cannot reopen or create another run.

## Concurrency

Start takes transaction-scoped PostgreSQL advisory locks for assignment, driver and vehicle in lexicographically deterministic order, then re-reads state. Four simultaneous starts created exactly one ServiceRun. Exclusion constraints remain the final concurrency guard for assignment writes.

## Student API

Student endpoints list active campuses, their active lines, materialized departures by valid civil date/direction and departure detail. Detail projects per-assignment operation state, so ASSIGNED, IN_PROGRESS and COMPLETED can coexist for a departure. It exposes display names only; no driver user ID, email or phone is selected.

## Driver API

Driver identity is derived only from `JWT.sub → Driver.userId`. A driver cannot inspect, start or finish another driver's assignment/run. The HTTP integration verifies cross-driver denial and stable start/current/finish behavior.

## Admin API

Admin and SuperAdmin are required at controller level for catalog, timetable, assignment creation and paginated assignment/run reports. Existing admin endpoints are not weakened or repurposed.

## RBAC

The global JWT and roles guards read both method and controller metadata. Student, Driver and Admin endpoints declare their required roles; requests without an authorized identity fail closed.

## IDOR

Resource ownership is checked at the relevant boundary: JourneyTemplate versus departure source/line/direction, driver versus assignment/run, and Student resources versus active campus/service line. API integration exercises the driver cross-resource denial; domain integration exercises mismatched journey rejection.

## Dataset

`pnpm prisma:seed:phase6:qa` is explicit, blocked when `NODE_ENV=production`, prefixes all rows `DEVQA-P6`, materializes through CalendarResolver/ScheduledDepartureMaterializer and creates Ruta Norte IDA/RETORNO, three assignments and one active run. Two executions remained `3|1|4|1`; explicit cleanup with `PHASE6_QA_MODE=cleanup PHASE6_QA_CONFIRM=DELETE` produced `0|0|0|0`.

## Legacy

Schedule is ACTIVE. RouteAssignment, Trip and `currentOperation` are COMPATIBILITY. Their schema and endpoints remain present; new operational endpoints do not read through them and no legacy deletion was performed.

## PostgreSQL

An isolated PostgreSQL 17 instance applied all six migrations using `prisma migrate deploy`; `prisma migrate status` reported the schema up to date. Calendar, ScheduledDeparture and materializer integration gates passed 1, 1 and 10 tests. Phase 6 operational and HTTP gates passed 5 and 3 tests.

## CI

The existing single API Quality Gate retains PostgreSQL 17-alpine, Node 20 and pnpm 10.34.5. It preserves the three calendar gates and adds hard-fail Phase 6 domain/API gates with `TZ=America/Guayaquil`; neither uses `continue-on-error` or error swallowing.

## OpenAPI

OpenAPI contract validation passed. New controllers carry operational tags and use DTO validation plus UUID path parsing. Legacy response contracts are not modified.

## Findings

- F6-LOW-001 — resolved. Exact half-open handoff had correct SQL semantics but lacked an explicit PostgreSQL regression test. Added the 06:40–07:30 then 07:30–08:20 acceptance test.
- F6-LOW-002 — resolved. The new opt-in test increased global skipped tests from 19 to 20; implementation and review reports now record the correct count and gate mapping.
- F6-LOW-003 — resolved. The first new handoff fixture inadvertently overlapped the pre-existing concurrency fixture. Root cause was an expected reservation conflict, not a transactional failure; the race now uses an available vehicle/driver and passes.

## Fixes Applied

Only the Phase 6 PostgreSQL fixture/test and associated factual documentation were changed during review. No migration or architectural correction was necessary.

## Remaining Risks

No Phase 6 blocker remains. Cancellation workflow, GPS/telemetry, realtime status, Admin Web and mobile migration intentionally remain future-phase scope. Remote CI must still certify the candidate and merged main before Phase 6 can close.

## Git Decision

GO GIT CLOSURE = YES. Commit only reviewed Phase 6 files with explicit staging; push, PR, merge and final closure remain conditional on actual GitHub Actions results.

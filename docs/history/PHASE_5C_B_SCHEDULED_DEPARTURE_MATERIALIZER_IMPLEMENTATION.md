# UPS GO — Phase 5C-B ScheduledDeparture Materializer

## 1 Verdict

**Technical BUILD verdict: GO for independent external review.**

The implementation is an additive, read-through materialization port from
`CalendarResolverService` to the existing `ScheduledDeparture` model. The
local QA evidence supplied for this build is PASS, including PostgreSQL
integration and the dedicated CI configuration. Remote CI execution is still
PENDING because this branch has not gone through Git closure.

```text
BUILD:                 PASS
LOCAL QA:              PASS
CI CONFIGURATION:      PASS
REMOTE CI EXECUTION:   PENDING
COMMIT:                NO
PUSH:                  NO
PR:                    NO
5C-C:                  NO
```

## 2 Scope

This phase implements the application service that materializes resolved
calendar departures into `ScheduledDeparture` for a bounded date range.

In scope:

- input validation and inclusive range enumeration;
- one resolver call per civil service date;
- mapping resolved regular and exception departures;
- append-only persistence with idempotent natural identity;
- existing-row comparison and reconciliation reporting;
- deterministic counters, date results and structured operational logs;
- unit, repository and PostgreSQL integration coverage;
- a dedicated hard-fail CI integration step.

Out of scope:

- `ServiceAssignment` and `ServiceRun`;
- bus, driver, GPS or trip-start semantics;
- controllers, public API endpoints or OpenAPI changes;
- automatic scheduling, workers, queues or backfill execution;
- changes to `apps/mobile`, legacy contracts, Prisma schema or migrations.

## 3 Baseline

The implementation is based on the certified `main` baseline:

```text
2119f5bcd967f7b6d432313d6e722a8e297e2097
```

The previous certified phases are 5A, 5B-A and 5B-B. The current worktree is
the isolated Phase 5C-B materializer worktree. The implementation changes are
confined to the calendar module, its tests, the API package script and the CI
workflow; this document is the only documentation artifact produced by this
agent.

## 4 Architecture

The application boundary is:

```text
MaterializeScheduledDeparturesInput
        |
        v
ScheduledDepartureMaterializerService
        |
        +--> CalendarResolverService.resolveSchedule(...)
        |
        +--> ScheduledDepartureRepository.materializeDate(...)
        |          |
        |          +--> createMany(skipDuplicates: true)
        |          +--> expected-identity batch read
        |          +--> scope batch read
        |
        v
MaterializationRangeResult
```

`CalendarModule` continues to export the pre-existing
`CalendarResolverService`. `ScheduledDepartureMaterializerService` is a private
provider of the Calendar module until a real in-scope consumer exists. The
repository owns Prisma access and transaction boundaries. The pure functions
own validation, date enumeration, provenance mapping, snapshot comparison and
deterministic sorting. There is no controller, cron, worker or automatic
scheduler in this phase.

## 5 Input Contract

The public application-service input is:

```ts
type MaterializeScheduledDeparturesInput = {
  serviceLineId: string;
  direction: Direction;
  fromDate: string;
  toDate?: string;
};
```

Rules:

- `serviceLineId` must match the accepted UUID format;
- `direction` must be `IDA` or `RETORNO`;
- dates must be valid civil dates in `YYYY-MM-DD` form;
- omitted `toDate` is normalized to `fromDate`;
- `fromDate` must not be after `toDate`;
- the inclusive range is limited to 31 dates;
- invalid input fails before consulting the resolver or repository.

The service uses the canonical local-date parser already used by the calendar
resolver. Date arithmetic is civil-date arithmetic and does not depend on the
host machine's local timezone.

## 6 Output Contract

The service returns:

```ts
type MaterializationRangeResult = {
  serviceLineId: string;
  direction: Direction;
  fromDate: string;
  toDate: string;
  totalDates: number;
  processedDates: number;
  noServiceDates: number;
  created: number;
  existingSame: number;
  existingDifferent: number;
  missingFromCurrentResolution: number;
  errors: number;
  dates: MaterializationDateResult[];
};
```

Each date reports its outcome (`MATERIALIZED`, `NO_SERVICE`,
`RECONCILIATION_REQUIRED` or `RESOLUTION_FAILED`), availability, resolver
resolution, resolved/created/existing counters, differences, stale rows,
resolver warnings and a resolver domain error when applicable.

`processedDates` excludes only `RESOLUTION_FAILED` dates. An infrastructure or
invariant failure is thrown and aborts the service call rather than being
silently converted into a successful range result.

## 7 CalendarResolver Integration

For every enumerated date, the materializer calls exactly:

```ts
calendarResolver.resolveSchedule({
  serviceLineId,
  direction,
  serviceDate,
});
```

The resolver remains the sole source of calendar truth. The materializer does
not query `ServiceCalendar`, `SchedulePattern`, `ScheduleTime` or
`ServiceException` directly and does not reimplement calendar precedence.

The returned schedule is validated against the requested line, direction and
date. Its `serviceCalendarId`, departure identities, resolution and exception
provenance are also validated before persistence.

## 8 Materialization Algorithm

For each date, sequentially:

1. Resolve the date through `CalendarResolverService`.
2. On a resolver domain result with `ok: false`, return `RESOLUTION_FAILED`
   for that date without persistence and continue the bounded range.
3. Validate the resolved scope and departure provenance.
4. If the resolver returns unavailable service, perform only the NO_SERVICE
   scope read described below; never write.
5. If service is available, convert each resolved departure into one write
   snapshot.
6. Persist the batch through one repository transaction for that date.
7. Compare the post-write identity rows with the expected snapshots.
8. Compare the complete scope with the current resolution to identify stale
   rows without deleting them.
9. Return deterministic date counters and reconciliation details.

Resolver errors and `NO_SERVICE` therefore produce no writes. Repository
infrastructure failures and invariant violations fail closed.

## 9 Mapping

Each resolved departure maps as follows:

| Resolver value               | `ScheduledDeparture` value                                   |
| ---------------------------- | ------------------------------------------------------------ |
| `scheduleTimeId`             | `sourceScheduleTimeId`                                       |
| `serviceCalendarId`          | `serviceCalendarId`                                          |
| requested/resolved line      | `serviceLineId`                                              |
| resolved civil date          | `serviceDate`                                                |
| `departureTime`              | `scheduledTime`                                              |
| requested/resolved direction | `direction`                                                  |
| `REGULAR`                    | `source = REGULAR`, `sourceExceptionId = null`               |
| `EXCEPTION_REPLACE`          | `source = EXCEPTION_REPLACE`, matching exception ID required |
| `EXCEPTION_ADD`              | `source = EXCEPTION_ADD`, matching exception ID required     |

`scheduledTime` is represented as a JavaScript `Date` at the PostgreSQL time
anchor used by the repository, while the returned snapshot uses `HH:mm:ss`.
Duplicate `scheduleTimeId` values, invalid times, out-of-scope schedules and
invalid exception provenance raise `MaterializerInvariantError`.

## 10 Idempotency

The natural identity is:

```text
sourceScheduleTimeId + serviceDate
```

It deliberately does not use line, direction or nominal clock time. This
preserves distinct departures that happen to share a nominal time and exposes
corrupted/divergent snapshots for reconciliation.

Persistence uses `createMany({ skipDuplicates: true })`. A repeated
materialization creates zero additional rows and reports semantically equal
rows as `existingSame`. It never updates an existing snapshot.

## 11 Concurrency

Concurrent calls are safe at the natural-identity boundary: PostgreSQL's
unique constraint plus `skipDuplicates` prevents duplicate rows and avoids
surfacing `P2002` for the tested concurrent materializations.

Transactions use PostgreSQL's default **READ COMMITTED** isolation. No
application-level lock, advisory lock, Redis lock or queue is introduced.
Concurrent callers can independently observe and report reconciliation state;
the append-only invariant remains protected by the database identity.

## 12 Transaction Boundaries

An available-service date is persisted in one `PrismaService.$transaction`
callback. Within that transaction the repository performs:

1. one bulk `createMany` with `skipDuplicates: true`;
2. one batch read for expected natural identities;
3. one batch read for the complete line/date/direction scope.

The range is not wrapped in one large transaction. Each date has its own
transaction, so a successful date is not rolled back because another date has
a resolver domain failure. A database error rolls back the whole date batch.

For NO_SERVICE, the repository performs a read-only scope query outside the
materialization transaction path because there are no writes.

## 13 Existing Row Semantics

Existing rows are classified against the current resolver snapshot:

- **same**: natural identity and all compared snapshot fields match;
- **different**: natural identity matches but one or more snapshot fields
  differ;
- **missing from current resolution**: the row remains in the requested
  line/date/direction scope but its `sourceScheduleTimeId` is absent from the
  current resolved set.

Compared fields are `serviceCalendarId`, `serviceLineId`, `scheduledTime`,
`direction`, `source` and `sourceExceptionId`. Existing rows are never updated
or deleted by 5C-B. Difference and stale-row lists are sorted by scheduled time
and then source identity for deterministic output.

## 14 Reconciliation Boundary

`RECONCILIATION_REQUIRED` is an explicit safety boundary, not an automatic
repair instruction. It is returned when an existing snapshot differs from the
current resolution or when a scoped row is absent from the current resolution.

The materializer preserves the database state and reports the expected and
existing snapshots. Resolving why a published calendar changed, whether a
historical departure should be retained, and how to correct it belongs to a
future controlled operational/admin workflow.

## 15 NO_SERVICE

For `serviceAvailable: false` and resolver resolution `NO_SERVICE`:

- no `ScheduledDeparture` write is attempted;
- existing rows in the requested line/date/direction scope are read;
- no existing rows yields `NO_SERVICE`;
- any existing rows yields `RECONCILIATION_REQUIRED` with those rows reported
  as missing from the current resolution;
- the historical rows remain untouched.

This preserves the difference between “the calendar says no service” and “a
bus actually ran or a historical snapshot exists.”

## 16 Errors

Input errors are typed as `MaterializerInputError` with codes for invalid UUID,
direction, dates, date order and an over-large range.

Resolver domain errors are returned per date as `RESOLUTION_FAILED`, counted in
`errors`, and do not write. Unexpected resolver failures are wrapped as
`MaterializerInfrastructureError` and fail the call without consulting
persistence for that date.

Repository failures are wrapped as infrastructure failures unless they are
explicit invariant failures. Invariant failures include duplicate natural
identities, invalid resolved times, invalid provenance, out-of-scope resolver
results and post-write identity inconsistencies. No error path silently
updates, deletes or invents a departure.

## 17 Range Processing

The range is inclusive and bounded to 31 civil dates. A single date is the
default when `toDate` is omitted. Dates are enumerated in ascending ISO order
and processed sequentially, preserving one resolver decision and one result
per date.

The range summary aggregates created rows, same snapshots, differences, stale
rows, no-service dates and resolver failures. Infrastructure and invariant
exceptions terminate the call rather than producing a partial success claim.

## 18 Repository

`ScheduledDepartureRepository` is the Prisma infrastructure adapter. It uses a
typed `ScheduledDepartureSelect`, maps database `Date` and `Time` values to
civil-date/time strings, validates that a write batch has exactly one
line/date/direction scope, and rejects duplicate natural identities before
opening the transaction.

The repository exposes two operations:

- `materializeDate(writes)`: bulk insert plus the two post-insert batch reads;
- `findScopeByInput(input)`: read-only scope lookup for NO_SERVICE.

It does not expose update or delete behavior to the materializer.

## 19 Tests

Unit and repository coverage verifies:

- UUID, direction, date and 31-day validation;
- regular, ADD and REPLACE provenance mapping;
- duplicate identities, invalid times and out-of-scope results;
- resolver failures without persistence calls;
- NO_SERVICE without writes;
- same/different/missing classification and deterministic ordering;
- nominal clock-time collisions;
- repeated idempotent materialization;
- infrastructure error wrapping and logging;
- one transaction, one bulk insert and two batch reads.

The integration suite additionally exercises regular and exception schedules,
NO_SERVICE, historical NO_SERVICE reconciliation, repeated runs, four-way
concurrency, divergent line/direction identity rows, snapshot preservation,
stale rows and transaction rollback after an invalid source foreign key.

## 20 PostgreSQL Integration

Fresh QA evidence supplied for this BUILD:

```text
PostgreSQL migrations:       5 up-to-date
Calendar integration:        1/1 PASS
ScheduledDeparture:          1/1 PASS
Materializer integration:    10/10 PASS
Cleanup fixtures:            0 residual rows
```

The integration fixtures are synthetic and guarded against production
execution. They demonstrate that nominal time collisions remain separate by
natural identity, exception provenance is preserved, and an invalid batch
foreign key rolls back the complete date transaction.

An initial integration failure exposed a Date-string incompatibility in the
Prisma `createMany` path. The closed fix normalizes the persisted civil date
and time to JavaScript `Date` values before insertion; the materializer
integration was then rerun with the PASS result above.

## 21 CI

The API package defines the dedicated command:

```text
test:scheduled-departure-materializer:integration
```

The GitHub Actions API job runs it against its PostgreSQL service with:

```text
RUN_SCHEDULED_DEPARTURE_MATERIALIZER_INTEGRATION=true
TZ=America/Guayaquil
```

The step is hard-fail and runs before lint, typecheck, build, unit tests and
OpenAPI validation. The explicit timezone protects the civil-date/TIME contract
from future runner defaults. Package and YAML configuration validation is PASS.
Remote execution is **PENDING** until Git closure creates a commit/PR that
GitHub can run; this document makes no claim about a remote run that has not
occurred.

## 22 Performance

The implementation is intentionally bounded and predictable:

- at most 31 resolver calls per invocation;
- sequential date processing avoids an unbounded write fan-out;
- one bulk insert rather than one insert per departure;
- two batch reads per available date rather than per-row reads;
- indexed natural identity and line/date/direction access paths already exist
  in the certified schema;
- no per-row `AuditLog`, queue, cache or background scheduler is created.

The range limit and batch shape are appropriate for this first operational
projection. Larger horizon generation, scheduling and operational assignment
should be evaluated with measured workload data in a later phase.

## 23 Legacy Compatibility

5C-B does not alter the 90 legacy `Schedule` rows or their consumers. The
current legacy classification is:

| Legacy area        | Classification | 5C-B behavior                                                                          |
| ------------------ | -------------- | -------------------------------------------------------------------------------------- |
| `Schedule`         | ACTIVE         | Preserved and not rewritten; legacy readers continue unchanged.                        |
| `RouteAssignment`  | ACTIVE         | Existing assignment API and consumers remain unchanged.                                |
| `Trip`             | ACTIVE         | Existing trip and driver-operation behavior remains unchanged.                         |
| `currentOperation` | ACTIVE         | Existing mobile projection remains available until the operational domain replaces it. |

The new materializer is not a replacement contract for those consumers and
does not expose a public API. `ServiceAssignment` and `ServiceRun` are not
implemented, so no legacy decommissioning can be claimed here.

## 24 Dead-Code / Residue Audit

The Phase 5C-B residue gate is PASS for this scope:

- no dead legacy contract was deleted;
- no commented-out implementation was left;
- no temporary adapter, feature flag, Redis/BullMQ dependency or scheduler was
  introduced;
- no orphaned import, script or endpoint was identified in the 5C-B diff;
- no row-level `AuditLog` side effect was added;
- no `ServiceAssignment` or `ServiceRun` placeholder was introduced.

The criteria for eventual removal are explicit: legacy `Schedule` is removable
only after all read consumers and the compatibility migration are demonstrated;
`RouteAssignment` and `Trip` are removable only after assignment/run consumers
and mobile projections migrate; `currentOperation` is removable only after its
replacement is consumed and legacy API compatibility is retired. Those
criteria are not met in 5C-B.

## 25 Security

The materializer validates all input at its application boundary, fails closed
on invalid resolver output, avoids logging secrets or payload data, and writes
only the requested service-line/direction/date scope. The repository uses
typed Prisma selections and database foreign keys/unique constraints for
integrity.

There is no new public endpoint or authorization surface in 5C-B. When an
Admin or operational endpoint is later added, it must derive tenant/company
scope from authenticated context, apply RBAC, validate UUID/date input and
avoid trusting caller-supplied ownership identifiers alone.

## 26 Validation

Fresh QA evidence supplied for the implementation:

```text
Node:                         20.20.2
pnpm:                         10.34.5
Prisma validate:              PASS
Lint:                         PASS
Typecheck:                    PASS
Build:                        PASS
Global Jest:                  19 suites passed / 3 opt-in skipped
Global Jest assertions:       179 passed / 12 skipped
OpenAPI with CI environment:  PASS
Package/YAML validation:      PASS
Prisma migrations:            5 up-to-date
Prisma/public API/Mobile:     unchanged by 5C-B
```

The acceptance matrix is PASS for all required local items: resolver
delegation, domain/error rules, read-only NO_SERVICE behavior, mapping,
idempotency, concurrency, append-only reconciliation, transaction rollback,
legacy isolation, Prisma/migration preservation, OpenAPI preservation and
Mobile preservation. The CI configuration check is PASS; actual remote CI
execution remains PENDING.

## 27 Remaining Risks

The remaining risks are release and product sequencing risks, not an identified
local implementation failure:

- remote CI has not yet certified this branch;
- reconciliation is reported but has no controlled repair workflow yet;
- materialization is an application port with no automatic trigger;
- `ScheduledDeparture` is still only a scheduled snapshot and is not proof of
  a bus in route;
- assignment, driver authentication, GPS and actual run lifecycle remain
  future work;
- legacy and new domains coexist until consumer migration is demonstrated;
- larger horizon performance and operational retention policies are not yet
  validated.

## 28 Next Step

The next authorized checkpoint is **independent external review of the complete
5C-B BUILD**. After that review, the sequence is:

```text
External review
    -> remediation if required
    -> fresh local revalidation
    -> authorized commit/push/PR
    -> remote CI certification
    -> 5C-B closure
    -> separate 5C-C readiness/design
```

No commit, push, PR, merge or 5C-C implementation is authorized by this
document. `ServiceAssignment` and `ServiceRun` must remain unimplemented until
the materializer is externally reviewed and the remote CI gate is certified.

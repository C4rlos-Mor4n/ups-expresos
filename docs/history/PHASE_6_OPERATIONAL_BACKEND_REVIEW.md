# UPS GO — Phase 6 Internal Review

## Verdict

Initial internal review: PASS subject to final complete local QA.

## Schema and migration audit

The migration is additive. It has no `DROP`, `TRUNCATE`, mass `DELETE` or unsafe alteration. All new operational foreign keys use `RESTRICT`. Foreign keys queried by assignment/runs have indexes. `btree_gist` enables two partial exclusion constraints for `ASSIGNED` windows.

## Concurrency audit

Database exclusion constraints reject concurrent overlapping vehicle/driver assignments. ServiceRun start locks deterministic resource keys inside a short database transaction, re-reads after lock acquisition and is protected by the unique assignment relation. Four concurrent starts produce exactly one run.

## Security and API audit

RBAC is controller-level and JWT guards remain global. Driver IDs are never accepted by Driver operations. Student DTO projections omit private driver fields. Admin lists are paginated. No raw Prisma entity is emitted by the Student contract.

## Domain, time and lifecycle audit

`ScheduledDeparture` remains schedule fact, `ServiceAssignment` remains planned allocation and `ServiceRun` alone represents live operation. Assignment windows are derived in Ecuador civil time and persisted as UTC instants. An invalid or zero-duration journey is rejected. The half-open range policy permits exact handoff but rejects overlap.

Start/finish are transition-safe: start is idempotent only for the same eligible assignment and does not take driver identity from request payload; finish is conditional and idempotent. No public route can bypass assignment or manufacture a run.

## CI, performance and test audit

Both opt-in PostgreSQL integration suites are invoked as required hard-fail steps in the existing API Quality Gate; neither step uses `continue-on-error` or an error-swallowing fallback. Lookup/list keys have supporting indexes, reports are bounded with pagination, and no N+1 loop is used for the product flows.

Fresh-database evidence: migrations current; Prisma format/validate/generate, lint, typecheck, build and OpenAPI passed; legacy PostgreSQL integrations passed 12 tests, Phase 6 PostgreSQL integrations passed 8 tests, and global Jest passed 182 with 20 documented opt-in skips. Synthetic DEV/QA cleanup was executed and the rebuilt database ended with zero operational/test catalog rows.

## Legacy and residue audit

Legacy touched: none. `RouteAssignment`, `Trip` and `currentOperation` are COMPATIBILITY; `Schedule` is ACTIVE. No new code consumes them. New scripts, flags and CI steps have consumers. No commented or temporary implementation was added.

## Findings and fixes

- LOW fixed: the first DEV/QA dataset version violated the resolver rule that the first path stop must have offset zero. The dataset now creates two stops per path and writes offset `0` plus the final duration; it materializes successfully.
- No open CRITICAL, HIGH or MEDIUM findings.

## GO / NO-GO

GO for independent Phase 6 build review only. Git closure remains explicitly unauthorized: no commit, push, PR or merge was performed or authorized.

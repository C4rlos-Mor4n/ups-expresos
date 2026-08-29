# Phase 7 — External Mobile Review and Remediation

## Scope and baseline

- Reviewed branch: `feature/phase-7-mobile-complete` in its isolated worktree.
- Baseline: `813934486235b8a5d912498c7a1d9db37e549974`.
- Scope: the Expo mobile client and its GitHub Actions quality gate only.
- Explicitly excluded: `apps/api`, Prisma, migrations, API/OpenAPI contracts,
  Admin Web, GPS, live tracking, ETA and Phase 8 work.

## Findings and remediation

| Severity | Finding | Resolution | Verification |
| --- | --- | --- | --- |
| High | A role could open the other role's route through a deep link before its endpoint authorization rejected the request. | Added role-aware route authorization at the root router. Student and Driver can enter only their own route trees; ADMIN and SUPER_ADMIN are routed to the unsupported-role surface. Server guards remain the source of truth. | `routes.test.ts` covers Student, Driver, unsupported roles and cross-role deep links. |
| Medium | The operational client trusted JSON solely through TypeScript generics; malformed payloads could reach list/detail rendering. | Added small, dependency-free runtime contract checks at the `operationalService` boundary. Invalid payloads become a safe UI error state. | `operational.service.test.ts` covers malformed payload rejection. |
| Medium | Driver authorization, not-found and stale-operation errors could show backend implementation text. | Added operation-specific friendly messages for `403`, `404`, `409` and invalid operational payloads. Authentication messaging remains unchanged. | `error-message.test.ts` covers authorization and malformed-payload messages. |
| Medium | Remote CI certified only API work. | Added mandatory `Mobile Quality Gate`: Node 20, `npm ci`, `npm run verify`, Android Expo export, no `continue-on-error`, no native Gradle build. | Node 20.20.2 exported the Android bundle locally with the exact CI command shape. |
| Low | The technical mobile package still used the former product name. | Renamed the package and lockfile root to `ups-go-mobile`. Existing Android/iOS application IDs stay unchanged so installed users receive an update rather than a second app. | Expo public config reports `UPS GO`, `ups-go`, `upsgo`, and preserved IDs. |
| Low | `types/feedback.ts` no longer had a consumer after legacy-flow removal. | Removed it as DEAD mobile code. | Consumer search is empty outside historical audit evidence. |

## Product, domain and UX gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Student flow uses the Phase 6 model | PASS | Campus → ServiceLine → date/direction → `ScheduledDeparture` → individual bus assignments. |
| Same-time / multiple-bus representation | PASS | UI identity and React keys use server IDs; no time-based merge or deduplication exists. |
| Scheduled service vs actual operation | PASS | Departure state and every assignment's operational state are explicitly rendered; `ServiceRun` information appears only when present. |
| Driver ownership and state transition | PASS | Driver calls only `/driver/operational/*`; start/finish require confirmation and only update from the server response. |
| Role resolution and refresh | PASS | The persisted session is reconciled through `/auth/me`; tests prove server-resolved role restoration with no local role selector. |
| Failure and empty states | PASS | All operational screens have loading, empty, retry and friendly-error states. |
| API client boundary | PASS | One `operationalService` uses the existing authenticated Axios client; no direct screen fetch, legacy `/mobile/*` call or local mock is present. |
| Identity and accessibility | PASS | UPS GO name/slug/scheme and own logo assets are active; app IDs remain compatible; buttons and state badges expose accessibility labels/states. |

## Legacy / dead-code gate

| Item | Classification | Disposition |
| --- | --- | --- |
| Legacy `/mobile/*` client, screens, route models, maps, favourites and feedback | DEAD in mobile | Removed with their direct unused dependencies. |
| `types/feedback.ts` | DEAD | Removed in this review. |
| Axios, SecureStore, OTP and refresh handling | ACTIVE | Preserved as the sole authentication/session path. |
| Server legacy endpoints and operational domain | COMPATIBILITY outside this scope | Untouched; no server consumer was removed. |
| `apps/mobile/docs/audits/UPS_EXPRESOS_MOBILE_AUDIT_PHASE_1_2026-08-19.md` | COMPATIBILITY historical evidence | Retained unchanged as a dated audit record; it is not runtime branding or an app consumer. |

No commented-out implementation, feature flag, orphan direct dependency or temporary adapter was introduced. Direct dependency checks show that the removed packages are absent at depth zero; Expo may still legitimately carry some as transitive dependencies.

## Validation evidence

Executed locally on 2026-08-29:

| Command / check | Result |
| --- | --- |
| `npm run verify` | PASS — Expo lint, `tsc --noEmit`, 8 suites / 46 tests. |
| `expo config --type public` | PASS — name `UPS GO`, slug `ups-go`, scheme `upsgo`; Android/iOS IDs remain `ec.edu.ups.expresos`. |
| Node 20.20.2 + `expo export --platform android` | PASS — Android JavaScript bundle exported. |
| `expo export --platform ios` | PASS — iOS JavaScript bundle exported. |
| `git diff --check` | PASS. |
| API / Prisma path diff versus baseline | PASS — no changed path. |
| Legacy/direct-request searches | PASS — no active mobile `/mobile/*`, Trip, RouteAssignment, favourites, feedback or direct screen HTTP consumer. |
| `npm audit --json` | 20 inherited dependency advisories: 11 moderate, 9 high, 0 critical. No audit fix or dependency upgrade was performed because it is a separate maintenance decision. |

Temporary export directories were created outside the repository and removed after each result. The generated native `apps/mobile/android` directory remains ignored and is not a tracked change.

## Native runtime boundary

An emulator/API connection was previously established, but a local development-client build stopped before app compilation because the installed Android build-tools `36.0.0` lacks `aapt` and reports itself corrupt. This repository change does not repair SDK installations. The native Student/Driver walkthrough is therefore deferred to **Phase 8**, after that external SDK repair and a rebuilt `upsgo` development client.

## Release recommendation

```text
EXTERNAL REVIEW:                PASS
AUTO-REMEDIATION:               COMPLETE
FULL MOBILE QA:                 PASS (static, type, unit and export)
NATIVE EMULATOR WALKTHROUGH:    DEFERRED TO PHASE 8 — external SDK issue

GO CI FIX:                      COMPLETE
GO COMMIT:                      YES
GO PUSH:                        YES
GO PR:                          YES
GO MERGE:                       CONDITIONAL ON REMOTE API + MOBILE GATES
GO PHASE 8:                     NO
```

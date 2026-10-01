# Phase 7 — Mobile Flow Contract

## Authority

The backend is the authority for the session, role, timetable, assignment ownership and operational state. The mobile app neither creates a `ServiceAssignment` nor infers an active trip from a scheduled time.

## Role resolution

After OTP verification, `AuthUser.role` determines the initial route:

| Role | Route | Capability |
| --- | --- | --- |
| `STUDENT` | `/(student)/(tabs)` | Consult service data only. |
| `DRIVER` | `/(driver)/(tabs)` | Consult owned assignments and start/finish the owned run. |
| Other supported backend roles | `/unsupported-role` | No mobile operational data is exposed. |

There is no manual role chooser or local role override.

## Student API mapping

| User step | Endpoint | Server-owned result shown in mobile |
| --- | --- | --- |
| Select campus | `GET /student/campuses` | Active campus. |
| Select service line | `GET /student/campuses/:campusId/service-lines` | Active line for that campus. |
| Select date and direction | `GET /student/service-lines/:serviceLineId/departures?date=YYYY-MM-DD&direction=IDA|RETORNO` | Each `ScheduledDeparture`, including its own ID, scheduled time, state and assignment count. |
| Open a departure | `GET /student/scheduled-departures/:id` | Line, campus, every assignment, visible vehicle/driver, planned window, route path and ordered stops. |

`scheduledTime` is formatted as a civil timetable value. The app deliberately does not merge departures that have the same clock time. A scheduled departure with zero assignments is displayed as **Programado**, not as an active bus.

## Driver API mapping

| User step | Endpoint | Server-owned result shown or action |
| --- | --- | --- |
| Home / service list | `GET /driver/operational/assignments/today` | Assignments owned by the authenticated driver for the Guayaquil operational day. |
| Detail | `GET /driver/operational/assignments/:id` | One owned assignment and its vehicle, path, planned window and run. |
| Start after confirmation | `POST /driver/operational/assignments/:id/start` | Idempotent `ServiceRun` start. |
| Current service | `GET /driver/operational/service-runs/current` | The authenticated driver’s current run or `null`. |
| Finish after confirmation | `POST /driver/operational/service-runs/:id/finish` | Idempotent run completion. |

The driver app never reads or writes legacy `Trip`, `RouteAssignment` or `currentOperation` contracts.

## State vocabulary

| Backend state | User-facing label | Meaning |
| --- | --- | --- |
| `SCHEDULED` | Programado | A departure exists for a date; no operational assignment is available. |
| `ASSIGNED` | Asignado | A vehicle and driver are assigned; the run has not started. |
| `IN_PROGRESS` | En recorrido | The driver started the associated `ServiceRun`. |
| `COMPLETED` | Finalizado | The associated `ServiceRun` ended. |

Every label is rendered with text and an icon; color is supplementary only.

## Offline and error contract

- A failed request renders a Spanish recovery state and an explicit retry control.
- Empty responses explain the selected context (date, campus or driver day); they are not treated as errors.
- SecureStore preserves a previously authenticated session; a failed network validation does not invent data.
- A refresh failure clears the session through the existing centralized Axios/SecureStore flow.

## Explicit non-goals

No GPS, live location, ETA, route maps, push notifications, Admin Web, local operational writes, user switching, backend contract changes or Prisma changes belong to Phase 7.

# UPS GO Phase 6 frontend API contract

All endpoints require Bearer JWT authentication. Student, Driver and Admin routes are separate contracts; new routes never fall back to `Schedule`, `RouteAssignment`, `Trip` or `currentOperation`.

## Student

- `GET /student/campuses`
- `GET /student/campuses/:campusId/service-lines`
- `GET /student/service-lines/:serviceLineId/departures?date=YYYY-MM-DD&direction=IDA|RETORNO`
- `GET /student/scheduled-departures/:id`

Departure state is projected as `SCHEDULED`, `ASSIGNED`, `IN_PROGRESS` or `COMPLETED`. A departure with three buses can simultaneously expose three independent assignment states. The detail returns vehicle code/plate, driver display name, planned window and ordered route-path stops; it never returns driver email, phone or user ID.

## Driver

- `GET /driver/operational/assignments/today`
- `GET /driver/operational/assignments/:id`
- `POST /driver/operational/assignments/:id/start`
- `GET /driver/operational/service-runs/current`
- `POST /driver/operational/service-runs/:id/finish`

Driver ownership is derived from `JWT.sub -> Driver.userId`; no driver ID is accepted in the request. Repeated start for the same in-progress assignment returns the existing run. Repeated finish returns the completed run.

## Admin

- `GET /admin/operational/campuses`
- `GET /admin/operational/service-lines?campusId=...`
- `GET /admin/operational/service-lines/:id/timetable?date=YYYY-MM-DD`
- `POST /admin/operational/service-assignments`
- `GET /admin/operational/service-assignments?date=...&serviceLineId=...&page=1&limit=20`
- `GET /admin/operational/service-runs?date=...&serviceLineId=...&page=1&limit=20`

`POST /admin/operational/service-assignments` accepts only `scheduledDepartureId`, `vehicleId`, `driverId` and `journeyTemplateId`. Planned timestamps are computed server-side in `America/Guayaquil`; a mismatched journey returns `409 INVALID_JOURNEY`, and overlapping driver/vehicle windows return `409 DRIVER_CONFLICT` or `409 VEHICLE_CONFLICT`.

## Compatibility

Existing `/mobile`, `/driver` legacy trip routes and `/admin/route-assignments` remain unchanged for current consumers. Phase 7 must use these new contracts for new screens; legacy migration and removal are Phase 8 work.

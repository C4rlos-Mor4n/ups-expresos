# Documentación detallada de rutas — UPS ExpresosApp API

> Documento pensado para el equipo de **frontend web** y **app mobile**. Explica qué recibe y qué devuelve cada ruta, cómo autenticarse, qué parámetros acepta y qué errores son esperables.

## Base URL actual de pruebas

- `http://localhost:3000`

## Reglas globales importantes

### Autenticación

- Las rutas protegidas requieren **Access Token** en el header `Authorization` con esquema Bearer.
- El **Refresh Token no se usa** como bearer para navegar la app.
- El refresh token solo se usa en la ruta de refresh, dentro del body.

### Rotación de refresh token

- Cada vez que se hace refresh de sesión, el backend devuelve:
  - nuevo access token
  - nuevo refresh token
- El refresh token anterior queda inválido.
- Si el cliente reutiliza el refresh token viejo, recibirá `401 Session expired or revoked`.

### Validación estricta de payloads

El backend tiene validación estricta. Si el cliente envía propiedades que la ruta no acepta, responderá con `400`.

Ejemplo típico:
- enviar `limit` a una ruta que no es paginada
- enviar campos extras no definidos en el DTO

### Paginación

Solo las rutas de listado paginado aceptan normalmente:
- `page`
- `limit`

No agreguen `page` o `limit` automáticamente a todas las rutas.

---

## Admin Drivers

### GET `/admin/drivers`

**Resumen:** List all drivers with pagination

**Autenticación:** Sí (Bearer access token)

**Query params aceptados**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `page` | No | `number` | Page number (1-based) |
| `limit` | No | `number` | Items per page |

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Paginated list of drivers | `DriverPaginatedResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de listado: sí acepta `page` y `limit`.

---

### POST `/admin/drivers`

**Resumen:** Create a new driver

**Autenticación:** Sí (Bearer access token)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `CreateDriverDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | Sí | Driver name |
| `phone` | `string` | No | Driver phone number |
| `licenseNumber` | `string` | No | Driver license number |
| `status` | `enum(ACTIVE, INACTIVE)` | No | Driver status Default: `ACTIVE`. |
| `assignedVehicleId` | `string (uuid)` | No | Assigned vehicle ID |
| `assignedRouteId` | `string (uuid)` | No | Assigned route ID |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 201 | Driver created successfully | `DriverResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

---

### GET `/admin/drivers/{id}`

**Resumen:** Get driver details

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Driver ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Driver details | `DriverResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Driver not found | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de detalle: no enviar `page` ni `limit`.

---

### PATCH `/admin/drivers/{id}`

**Resumen:** Update a driver

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Driver ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `UpdateDriverDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | No | Driver name |
| `phone` | `string` | No | Driver phone number |
| `licenseNumber` | `string` | No | Driver license number |
| `status` | `enum(ACTIVE, INACTIVE)` | No | Driver status Default: `ACTIVE`. |
| `assignedVehicleId` | `string (uuid)` | No | Assigned vehicle ID |
| `assignedRouteId` | `string (uuid)` | No | Assigned route ID |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Driver updated successfully | `DriverResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Driver not found | sin schema explícito / mensaje simple |

---

## Admin Notices

### GET `/admin/notices`

**Resumen:** List all notices with pagination

**Autenticación:** Sí (Bearer access token)

**Query params aceptados**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `page` | No | `number` | Page number (1-based) |
| `limit` | No | `number` | Items per page |

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Paginated list of notices | `NoticePaginatedResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de listado: sí acepta `page` y `limit`.

---

### POST `/admin/notices`

**Resumen:** Create a new notice

**Autenticación:** Sí (Bearer access token)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `CreateNoticeDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `title` | `string` | Sí | Notice title |
| `message` | `string` | Sí | Notice message |
| `severity` | `enum(INFO, WARNING, CRITICAL)` | No | Notice severity Default: `INFO`. |
| `publishedFrom` | `string (date-time)` | Sí | Publication start date in ISO 8601 format |
| `publishedUntil` | `string (date-time)` | No | Publication end date in ISO 8601 format |
| `isActive` | `boolean` | No | Whether the notice is active Default: `True`. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 201 | Notice created successfully | `NoticeResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

---

### GET `/admin/notices/{id}`

**Resumen:** Get notice details

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Notice ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Notice details | `NoticeResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Notice not found | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de detalle: no enviar `page` ni `limit`.

---

### PATCH `/admin/notices/{id}`

**Resumen:** Update a notice

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Notice ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `UpdateNoticeDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `title` | `string` | No | Notice title |
| `message` | `string` | No | Notice message |
| `severity` | `enum(INFO, WARNING, CRITICAL)` | No | Notice severity Default: `INFO`. |
| `publishedFrom` | `string (date-time)` | No | Publication start date in ISO 8601 format |
| `publishedUntil` | `string (date-time)` | No | Publication end date in ISO 8601 format |
| `isActive` | `boolean` | No | Whether the notice is active Default: `True`. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Notice updated successfully | `NoticeResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Notice not found | sin schema explícito / mensaje simple |

---

## Admin Routes

### GET `/admin/routes`

**Resumen:** List all routes with pagination

**Autenticación:** Sí (Bearer access token)

**Query params aceptados**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `page` | No | `number` | Page number (1-based) |
| `limit` | No | `number` | Items per page |

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Paginated list of routes | `RoutePaginatedResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de listado: sí acepta `page` y `limit`.

---

### POST `/admin/routes`

**Resumen:** Create a new route

**Autenticación:** Sí (Bearer access token)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `CreateRouteDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | Sí | Route name |
| `description` | `string` | No | Route description |
| `direction` | `string` | Sí | Route direction |
| `status` | `enum(ACTIVE, SUSPENDED, INACTIVE)` | No | Route status Default: `ACTIVE`. |
| `isActive` | `boolean` | No | Whether the route is active Default: `True`. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 201 | Route created successfully | `RouteResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 409 | Route already exists | sin schema explícito / mensaje simple |

---

### GET `/admin/routes/{id}`

**Resumen:** Get route details

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Route ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Route details | `RouteResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Route not found | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de detalle: no enviar `page` ni `limit`.

---

### PATCH `/admin/routes/{id}`

**Resumen:** Update a route

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Route ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `UpdateRouteDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | No | Route name |
| `description` | `string` | No | Route description |
| `direction` | `string` | No | Route direction |
| `status` | `enum(ACTIVE, SUSPENDED, INACTIVE)` | No | Route status Default: `ACTIVE`. |
| `isActive` | `boolean` | No | Whether the route is active Default: `True`. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Route updated successfully | `RouteResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Route not found | sin schema explícito / mensaje simple |

---

### PATCH `/admin/routes/{id}/stops/order`

**Resumen:** Order stops for a route

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Route ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `OrderRouteStopsDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `stops` | `array<RouteStopOrderItemDto>` | Sí | Ordered stops |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Stops ordered successfully | sin schema explícito / mensaje simple |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Route not found | sin schema explícito / mensaje simple |

**Notas operativas**

- La propiedad `stops` debe incluir cada parada con `stopId` y `stopOrder`.

---

## Admin Schedules

### GET `/admin/schedules`

**Resumen:** List schedules with pagination and filters

**Autenticación:** Sí (Bearer access token)

**Query params aceptados**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `page` | No | `number` | Page number (1-based) |
| `limit` | No | `number` | Items per page |
| `routeId` | No | `string` | Filter by route ID |
| `dayOfWeek` | No | `enum(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY)` | Filter by day of week |

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Paginated list of schedules | `SchedulePaginatedResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de listado: sí acepta `page` y `limit`.

---

### POST `/admin/schedules`

**Resumen:** Create a new schedule

**Autenticación:** Sí (Bearer access token)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `CreateScheduleDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `routeId` | `string (uuid)` | Sí | Route ID |
| `dayOfWeek` | `enum(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY)` | Sí | Day of week |
| `direction` | `string` | Sí | Direction |
| `departureTime` | `string` | Sí | Departure time in HH:mm format |
| `approximateArrivalTime` | `string` | No | Approximate arrival time in HH:mm format |
| `status` | `enum(ACTIVE, INACTIVE)` | No | Schedule status Default: `ACTIVE`. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 201 | Schedule created successfully | `ScheduleResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

---

### GET `/admin/schedules/{id}`

**Resumen:** Get schedule details

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Schedule ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Schedule details | `ScheduleResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Schedule not found | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de detalle: no enviar `page` ni `limit`.

---

### PATCH `/admin/schedules/{id}`

**Resumen:** Update a schedule

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Schedule ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `UpdateScheduleDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `routeId` | `string (uuid)` | No | Route ID |
| `dayOfWeek` | `enum(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY)` | No | Day of week |
| `direction` | `string` | No | Direction |
| `departureTime` | `string` | No | Departure time in HH:mm format |
| `approximateArrivalTime` | `string` | No | Approximate arrival time in HH:mm format |
| `status` | `enum(ACTIVE, INACTIVE)` | No | Schedule status Default: `ACTIVE`. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Schedule updated successfully | `ScheduleResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Schedule not found | sin schema explícito / mensaje simple |

---

## Admin Stops

### GET `/admin/stops`

**Resumen:** List all stops with pagination

**Autenticación:** Sí (Bearer access token)

**Query params aceptados**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `page` | No | `number` | Page number (1-based) |
| `limit` | No | `number` | Items per page |

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Paginated list of stops | `StopPaginatedResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de listado: sí acepta `page` y `limit`.

---

### POST `/admin/stops`

**Resumen:** Create a new stop

**Autenticación:** Sí (Bearer access token)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `CreateStopDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | Sí | Stop name |
| `reference` | `string` | No | Reference or address |
| `latitude` | `number` | Sí | Latitude coordinate |
| `longitude` | `number` | Sí | Longitude coordinate |
| `isActive` | `boolean` | No | Whether the stop is active Default: `True`. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 201 | Stop created successfully | `StopResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

---

### GET `/admin/stops/{id}`

**Resumen:** Get stop details

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Stop ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Stop details | `StopResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Stop not found | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de detalle: no enviar `page` ni `limit`.

---

### PATCH `/admin/stops/{id}`

**Resumen:** Update a stop

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Stop ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `UpdateStopDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | No | Stop name |
| `reference` | `string` | No | Reference or address |
| `latitude` | `number` | No | Latitude coordinate |
| `longitude` | `number` | No | Longitude coordinate |
| `isActive` | `boolean` | No | Whether the stop is active Default: `True`. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Stop updated successfully | `StopResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Stop not found | sin schema explícito / mensaje simple |

---

## Admin Vehicles

### GET `/admin/vehicles`

**Resumen:** List all vehicles with pagination

**Autenticación:** Sí (Bearer access token)

**Query params aceptados**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `page` | No | `number` | Page number (1-based) |
| `limit` | No | `number` | Items per page |

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Paginated list of vehicles | `VehiclePaginatedResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de listado: sí acepta `page` y `limit`.

---

### POST `/admin/vehicles`

**Resumen:** Create a new vehicle

**Autenticación:** Sí (Bearer access token)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `CreateVehicleDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `plate` | `string` | Sí | Vehicle license plate |
| `code` | `string` | Sí | Internal vehicle code |
| `capacity` | `number` | Sí | Passenger capacity |
| `status` | `enum(ACTIVE, MAINTENANCE, INACTIVE)` | No | Vehicle status Default: `ACTIVE`. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 201 | Vehicle created successfully | `VehicleResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 409 | Vehicle plate or code already exists | sin schema explícito / mensaje simple |

---

### GET `/admin/vehicles/{id}`

**Resumen:** Get vehicle details

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Vehicle ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Vehicle details | `VehicleResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Vehicle not found | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de detalle: no enviar `page` ni `limit`.

---

### PATCH `/admin/vehicles/{id}`

**Resumen:** Update a vehicle

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Vehicle ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `UpdateVehicleDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `plate` | `string` | No | Vehicle license plate |
| `code` | `string` | No | Internal vehicle code |
| `capacity` | `number` | No | Passenger capacity |
| `status` | `enum(ACTIVE, MAINTENANCE, INACTIVE)` | No | Vehicle status Default: `ACTIVE`. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Vehicle updated successfully | `VehicleResponseDto` |
| 400 | Invalid input | sin schema explícito / mensaje simple |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Vehicle not found | sin schema explícito / mensaje simple |

---

## Auth

### POST `/auth/logout`

**Resumen:** Logout and revoke session

**Autenticación:** Sí (Bearer access token)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `LogoutDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `refreshToken` | `string` | No | Refresh token to revoke. If not provided, attempts to revoke by session context. |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Logged out successfully | sin schema explícito / mensaje simple |
| 400 | Invalid request body | sin schema explícito / mensaje simple |
| 401 | Invalid or missing token | sin schema explícito / mensaje simple |

---

### GET `/auth/me`

**Resumen:** Get current authenticated user

**Autenticación:** Sí (Bearer access token)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Current user | `AuthUserDto` |
| 401 | Invalid or missing token | sin schema explícito / mensaje simple |

**Notas operativas**

- Usa `Authorization: Bearer <accessToken>`.
- No enviar refresh token aquí.

---

### POST `/auth/refresh`

**Resumen:** Refresh access token using a refresh token

**Autenticación:** No (pública)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `RefreshTokenDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `refreshToken` | `string` | Sí | Refresh token obtained from login or refresh response |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 201 | Tokens refreshed successfully | `AuthTokensDto` |
| 400 | Invalid refresh token format | sin schema explícito / mensaje simple |
| 401 | Invalid or expired refresh token | sin schema explícito / mensaje simple |

**Notas operativas**

- Recibe el `refreshToken` en el body. No usa ese token en `Authorization`.
- Si el cliente reutiliza un refresh token viejo, devolverá `401 Session expired or revoked`.

---

### POST `/auth/request-code`

**Resumen:** Request an OTP verification code

**Autenticación:** No (pública)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `RequestCodeDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `email` | `string` | Sí | Institutional email address used to request OTP verification |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 201 | Verification code sent | sin schema explícito / mensaje simple |
| 400 | Invalid email format | sin schema explícito / mensaje simple |
| 403 | Email domain not allowed | sin schema explícito / mensaje simple |
| 429 | Too many requests. Try again later. | sin schema explícito / mensaje simple |

---

### POST `/auth/verify-code`

**Resumen:** Verify OTP and obtain access/refresh tokens

**Autenticación:** No (pública)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `VerifyCodeDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `email` | `string` | Sí | Institutional email address |
| `code` | `string` | Sí | OTP verification code received via email |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 201 | Tokens generated successfully | `AuthTokensDto` |
| 400 | Invalid email or code format | sin schema explícito / mensaje simple |
| 401 | Invalid or expired code | sin schema explícito / mensaje simple |

---

## Health

### GET `/health`

**Resumen:** Basic health check

**Autenticación:** No (pública)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Service is healthy | sin schema explícito / mensaje simple |

---

### GET `/health/db`

**Resumen:** Database connectivity health check

**Autenticación:** No (pública)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Database connection is healthy | sin schema explícito / mensaje simple |

---

## Mobile

### GET `/mobile/notices`

**Resumen:** List active notices currently published

**Autenticación:** Sí (Bearer access token)

**Query params aceptados**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `page` | No | `number` | Page number (1-based) |
| `limit` | No | `number` | Items per page |

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Paginated list of active notices | `MobileNoticePaginatedResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de listado: sí acepta `page` y `limit`.

---

### GET `/mobile/routes`

**Resumen:** List active routes for mobile app

**Autenticación:** Sí (Bearer access token)

**Query params aceptados**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `page` | No | `number` | Page number (1-based) |
| `limit` | No | `number` | Items per page |
| `status` | No | `enum(ACTIVE, SUSPENDED, INACTIVE)` | Filter by route status |
| `search` | No | `string` | Search by route name or direction |

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Paginated list of active routes | `RoutePaginatedResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

**Notas operativas**

- Sí acepta `page` y `limit` porque es listado paginado.

---

### GET `/mobile/routes/{id}`

**Resumen:** Get route detail with ordered stops and active schedules

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Route ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Route detail | `MobileRouteDetailResponseDto` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |
| 404 | Route not found | sin schema explícito / mensaje simple |

**Notas operativas**

- Esta ruta no es paginada. No enviar `limit` ni `page`.

---

### GET `/mobile/routes/{id}/schedules`

**Resumen:** Get active schedules for a route

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Route ID |

**Query params aceptados**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `dayOfWeek` | No | `enum(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY)` | Filter by day of week |
| `direction` | No | `string` | Filter by direction |

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Active route schedules | `array<ScheduleResponseDto>` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

**Notas operativas**

- Esta ruta no es paginada. No enviar `limit` ni `page`.

---

### GET `/mobile/routes/{id}/stops`

**Resumen:** Get ordered stops for a route

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Route ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Ordered route stops | `array<MobileRouteStopResponseDto>` |
| 401 | Unauthorized | sin schema explícito / mensaje simple |
| 403 | Forbidden | sin schema explícito / mensaje simple |

**Notas operativas**

- Esta ruta no es paginada. No enviar `limit` ni `page`.

---

## Trip Feedback

### GET `/trip-feedback`

**Resumen:** List trip feedback with pagination

**Autenticación:** Sí (Bearer access token)

**Query params aceptados**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `page` | No | `number` | Page number (1-based) |
| `limit` | No | `number` | Items per page |
| `userId` | No | `string` | Filter by user ID |
| `routeId` | No | `string` | Filter by route ID |

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Paginated list of feedback | `TripFeedbackPaginatedResponseDto` |
| 401 | Not authenticated | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de listado: sí acepta `page` y `limit`.
- La versión GET es paginada; la versión POST crea un feedback nuevo.

---

### POST `/trip-feedback`

**Resumen:** Create trip feedback

**Autenticación:** Sí (Bearer access token)

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** `CreateTripFeedbackDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `routeId` | `string (uuid)` | Sí | ID of the route being reviewed |
| `driverId` | `string (uuid)` | No | ID of the driver (optional) |
| `rating` | `number` | Sí | Rating from 1 to 5 |
| `comment` | `string` | No | Optional comment |
| `travelDate` | `string (date-time)` | No | Date of travel (ISO 8601) |

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 201 | Feedback created successfully | `TripFeedbackResponseDto` |
| 400 | Invalid input data | sin schema explícito / mensaje simple |
| 401 | Not authenticated | sin schema explícito / mensaje simple |
| 404 | Route or driver not found | sin schema explícito / mensaje simple |

**Notas operativas**

- Ruta de listado: sí acepta `page` y `limit`.
- La versión GET es paginada; la versión POST crea un feedback nuevo.

---

### GET `/trip-feedback/{id}`

**Resumen:** Get trip feedback by ID

**Autenticación:** Sí (Bearer access token)

**Path params**

| Campo | Requerido | Tipo | Descripción |
|---|---:|---|---|
| `id` | Sí | `string` | Feedback ID |

**Query params aceptados:** ninguno documentado. Si envías propiedades extras, el backend puede responder `400`.

**Body esperado:** esta ruta no espera body JSON.

**Respuestas principales**

| HTTP | Significado | Sale de la ruta |
|---:|---|---|
| 200 | Feedback details | `TripFeedbackResponseDto` |
| 401 | Not authenticated | sin schema explícito / mensaje simple |
| 404 | Feedback not found | sin schema explícito / mensaje simple |

---

## Apéndice — schemas clave

### `RequestCodeDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `email` | `string` | Sí | Institutional email address used to request OTP verification |


### `VerifyCodeDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `email` | `string` | Sí | Institutional email address |
| `code` | `string` | Sí | OTP verification code received via email |


### `RefreshTokenDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `refreshToken` | `string` | Sí | Refresh token obtained from login or refresh response |


### `LogoutDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `refreshToken` | `string` | No | Refresh token to revoke. If not provided, attempts to revoke by session context. |


### `AuthTokensDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `accessToken` | `string` | Sí | JWT access token |
| `refreshToken` | `string` | Sí | Refresh token for obtaining new access tokens |
| `user` | `AuthUserDto` | Sí | - |


### `CreateRouteDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | Sí | Route name |
| `description` | `string` | No | Route description |
| `direction` | `string` | Sí | Route direction |
| `status` | `enum(ACTIVE, SUSPENDED, INACTIVE)` | No | Route status Default: `ACTIVE`. |
| `isActive` | `boolean` | No | Whether the route is active Default: `True`. |


### `UpdateRouteDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | No | Route name |
| `description` | `string` | No | Route description |
| `direction` | `string` | No | Route direction |
| `status` | `enum(ACTIVE, SUSPENDED, INACTIVE)` | No | Route status Default: `ACTIVE`. |
| `isActive` | `boolean` | No | Whether the route is active Default: `True`. |


### `OrderRouteStopsDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `stops` | `array<RouteStopOrderItemDto>` | Sí | Ordered stops |


### `RouteStopOrderItemDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `stopId` | `string (uuid)` | Sí | Stop ID |
| `stopOrder` | `number` | Sí | Order of the stop in the route |
| `estimatedArrivalMinutes` | `number` | No | Estimated arrival minutes from route start |
| `notes` | `string` | No | Notes for this stop in the route |


### `CreateStopDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | Sí | Stop name |
| `reference` | `string` | No | Reference or address |
| `latitude` | `number` | Sí | Latitude coordinate |
| `longitude` | `number` | Sí | Longitude coordinate |
| `isActive` | `boolean` | No | Whether the stop is active Default: `True`. |


### `UpdateStopDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | No | Stop name |
| `reference` | `string` | No | Reference or address |
| `latitude` | `number` | No | Latitude coordinate |
| `longitude` | `number` | No | Longitude coordinate |
| `isActive` | `boolean` | No | Whether the stop is active Default: `True`. |


### `CreateScheduleDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `routeId` | `string (uuid)` | Sí | Route ID |
| `dayOfWeek` | `enum(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY)` | Sí | Day of week |
| `direction` | `string` | Sí | Direction |
| `departureTime` | `string` | Sí | Departure time in HH:mm format |
| `approximateArrivalTime` | `string` | No | Approximate arrival time in HH:mm format |
| `status` | `enum(ACTIVE, INACTIVE)` | No | Schedule status Default: `ACTIVE`. |


### `UpdateScheduleDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `routeId` | `string (uuid)` | No | Route ID |
| `dayOfWeek` | `enum(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY)` | No | Day of week |
| `direction` | `string` | No | Direction |
| `departureTime` | `string` | No | Departure time in HH:mm format |
| `approximateArrivalTime` | `string` | No | Approximate arrival time in HH:mm format |
| `status` | `enum(ACTIVE, INACTIVE)` | No | Schedule status Default: `ACTIVE`. |


### `CreateVehicleDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `plate` | `string` | Sí | Vehicle license plate |
| `code` | `string` | Sí | Internal vehicle code |
| `capacity` | `number` | Sí | Passenger capacity |
| `status` | `enum(ACTIVE, MAINTENANCE, INACTIVE)` | No | Vehicle status Default: `ACTIVE`. |


### `UpdateVehicleDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `plate` | `string` | No | Vehicle license plate |
| `code` | `string` | No | Internal vehicle code |
| `capacity` | `number` | No | Passenger capacity |
| `status` | `enum(ACTIVE, MAINTENANCE, INACTIVE)` | No | Vehicle status Default: `ACTIVE`. |


### `CreateDriverDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | Sí | Driver name |
| `phone` | `string` | No | Driver phone number |
| `licenseNumber` | `string` | No | Driver license number |
| `status` | `enum(ACTIVE, INACTIVE)` | No | Driver status Default: `ACTIVE`. |
| `assignedVehicleId` | `string (uuid)` | No | Assigned vehicle ID |
| `assignedRouteId` | `string (uuid)` | No | Assigned route ID |


### `UpdateDriverDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `name` | `string` | No | Driver name |
| `phone` | `string` | No | Driver phone number |
| `licenseNumber` | `string` | No | Driver license number |
| `status` | `enum(ACTIVE, INACTIVE)` | No | Driver status Default: `ACTIVE`. |
| `assignedVehicleId` | `string (uuid)` | No | Assigned vehicle ID |
| `assignedRouteId` | `string (uuid)` | No | Assigned route ID |


### `CreateNoticeDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `title` | `string` | Sí | Notice title |
| `message` | `string` | Sí | Notice message |
| `severity` | `enum(INFO, WARNING, CRITICAL)` | No | Notice severity Default: `INFO`. |
| `publishedFrom` | `string (date-time)` | Sí | Publication start date in ISO 8601 format |
| `publishedUntil` | `string (date-time)` | No | Publication end date in ISO 8601 format |
| `isActive` | `boolean` | No | Whether the notice is active Default: `True`. |


### `UpdateNoticeDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `title` | `string` | No | Notice title |
| `message` | `string` | No | Notice message |
| `severity` | `enum(INFO, WARNING, CRITICAL)` | No | Notice severity Default: `INFO`. |
| `publishedFrom` | `string (date-time)` | No | Publication start date in ISO 8601 format |
| `publishedUntil` | `string (date-time)` | No | Publication end date in ISO 8601 format |
| `isActive` | `boolean` | No | Whether the notice is active Default: `True`. |


### `CreateTripFeedbackDto`

| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `routeId` | `string (uuid)` | Sí | ID of the route being reviewed |
| `driverId` | `string (uuid)` | No | ID of the driver (optional) |
| `rating` | `number` | Sí | Rating from 1 to 5 |
| `comment` | `string` | No | Optional comment |
| `travelDate` | `string (date-time)` | No | Date of travel (ISO 8601) |


# Guia de API para Web Administrativa (React)

Esta guia documenta los endpoints del panel administrativo de UPS ExpresosApp. Todos los endpoints `/admin/*` requieren autenticacion JWT y rol `ADMIN` o `SUPER_ADMIN`.

## Autenticacion y autorizacion

```http
Authorization: Bearer <accessToken>
```

**Roles requeridos:** `ADMIN` o `SUPER_ADMIN`

Si un usuario con rol `STUDENT` intenta acceder a estos endpoints, recibira un `403 Forbidden`.

Para obtener tokens, consulta [`AUTH_FLOW.md`](./AUTH_FLOW.md).

---

## Endpoints de Rutas

### POST /admin/routes

Crear una nueva ruta.

```http
POST /admin/routes
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Norte - Salesiana",
  "description": "Ruta que cubre el norte de la ciudad hacia el campus Salesiana",
  "direction": "Norte",
  "status": "ACTIVE",
  "isActive": true
}
```

#### Request body

| Campo | Tipo | Requerido | Validaciones | Descripcion |
|-------|------|-----------|--------------|-------------|
| `name` | string | Si | No vacio | Nombre de la ruta |
| `description` | string | No | - | Descripcion opcional |
| `direction` | string | Si | No vacio | Direccion de la ruta (ej: "Norte", "Sur") |
| `status` | string | No | Enum: `ACTIVE`, `SUSPENDED`, `INACTIVE` | Estado (default: `ACTIVE`) |
| `isActive` | boolean | No | - | Si la ruta esta activa (default: `true`) |

#### Response 201

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Norte - Salesiana",
  "description": "Ruta que cubre el norte de la ciudad",
  "direction": "Norte",
  "status": "ACTIVE",
  "isActive": true,
  "createdAt": "2026-07-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T10:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 400 | Campos invalidos o faltantes |
| 409 | Ruta ya existe (conflicto de unicidad) |

---

### GET /admin/routes

Listar todas las rutas con paginacion.

```http
GET /admin/routes?page=1&limit=20
Authorization: Bearer <accessToken>
```

#### Query params

| Param | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `page` | number | No | Numero de pagina (default: 1, minimo: 1) |
| `limit` | number | No | Items por pagina (default: 20, max: 100) |

#### Response 200

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Norte - Salesiana",
      "description": "Ruta que cubre el norte de la ciudad",
      "direction": "Norte",
      "status": "ACTIVE",
      "isActive": true,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-15T14:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### GET /admin/routes/:id

Obtener detalle de una ruta.

```http
GET /admin/routes/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Norte - Salesiana",
  "description": "Ruta que cubre el norte de la ciudad",
  "direction": "Norte",
  "status": "ACTIVE",
  "isActive": true,
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-06-15T14:30:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 404 | Ruta no encontrada |

---

### PATCH /admin/routes/:id

Actualizar una ruta. Solo se envian los campos a modificar.

```http
PATCH /admin/routes/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Norte - Salesiana (actualizada)",
  "status": "SUSPENDED"
}
```

#### Request body (todos los campos son opcionales)

| Campo | Tipo | Validaciones |
|-------|------|--------------|
| `name` | string | No vacio |
| `description` | string | - |
| `direction` | string | No vacio |
| `status` | string | Enum: `ACTIVE`, `SUSPENDED`, `INACTIVE` |
| `isActive` | boolean | - |

#### Response 200

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Norte - Salesiana (actualizada)",
  "description": "Ruta que cubre el norte de la ciudad",
  "direction": "Norte",
  "status": "SUSPENDED",
  "isActive": true,
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T12:00:00.000Z"
}
```

---

### PATCH /admin/routes/:id/stops/order

Ordenar las paradas de una ruta. Este endpoint reemplaza el orden existente.

```http
PATCH /admin/routes/550e8400-e29b-41d4-a716-446655440000/stops/order
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "stops": [
    {
      "stopId": "stop-id-1",
      "stopOrder": 0,
      "estimatedArrivalMinutes": 0,
      "notes": "Punto de partida"
    },
    {
      "stopId": "stop-id-2",
      "stopOrder": 1,
      "estimatedArrivalMinutes": 15,
      "notes": null
    },
    {
      "stopId": "stop-id-3",
      "stopOrder": 2,
      "estimatedArrivalMinutes": 30,
      "notes": "Parada principal"
    }
  ]
}
```

#### Request body

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `stops` | array | Si | Lista ordenada de paradas (minimo 1 elemento) |
| `stops[].stopId` | string (UUID) | Si | ID de la parada |
| `stops[].stopOrder` | number | Si | Orden (entero >= 0) |
| `stops[].estimatedArrivalMinutes` | number | No | Minutos estimados desde el inicio (>= 0) |
| `stops[].notes` | string | No | Notas para esta parada en la ruta |

#### Response 200

```json
{
  "message": "Stops ordered successfully"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 400 | Lista vacia o datos invalidos |
| 404 | Ruta no encontrada |

---

### DELETE /admin/routes/:id

Desactivar una ruta (soft delete). La ruta queda con `isActive=false` y deja de aparecer en la app movil.

```http
DELETE /admin/routes/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Norte - Salesiana",
  "description": null,
  "direction": "Norte",
  "status": "ACTIVE",
  "isActive": false,
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T12:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 404 | Ruta no encontrada |

---

## Endpoints de Paradas

### POST /admin/stops

Crear una nueva parada.

```http
POST /admin/stops
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Parque de la Madre",
  "reference": "Av. 12 de Abril y Loja",
  "latitude": -2.8975000,
  "longitude": -79.0045000,
  "isActive": true
}
```

#### Request body

| Campo | Tipo | Requerido | Validaciones | Descripcion |
|-------|------|-----------|--------------|-------------|
| `name` | string | Si | No vacio | Nombre de la parada |
| `reference` | string | No | - | Referencia o direccion |
| `latitude` | number | Si | Min: -90, Max: 90 | Latitud GPS |
| `longitude` | number | Si | Min: -180, Max: 180 | Longitud GPS |
| `isActive` | boolean | No | - | Si la parada esta activa (default: `true`) |

#### Response 201

```json
{
  "id": "stop-id-1",
  "name": "Parque de la Madre",
  "reference": "Av. 12 de Abril y Loja",
  "latitude": -2.8975000,
  "longitude": -79.0045000,
  "isActive": true,
  "createdAt": "2026-07-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T10:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 400 | Latitud fuera de rango (-90 a 90) |
| 400 | Longitud fuera de rango (-180 a 180) |

---

### GET /admin/stops

Listar todas las paradas con paginacion.

```http
GET /admin/stops?page=1&limit=20
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "data": [
    {
      "id": "stop-id-1",
      "name": "Parque de la Madre",
      "reference": "Av. 12 de Abril y Loja",
      "latitude": -2.8975000,
      "longitude": -79.0045000,
      "isActive": true,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

---

### GET /admin/stops/:id

Obtener detalle de una parada.

```http
GET /admin/stops/stop-id-1
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "id": "stop-id-1",
  "name": "Parque de la Madre",
  "reference": "Av. 12 de Abril y Loja",
  "latitude": -2.8975000,
  "longitude": -79.0045000,
  "isActive": true,
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-06-01T10:00:00.000Z"
}
```

---

### PATCH /admin/stops/:id

Actualizar una parada. Solo se envian los campos a modificar.

```http
PATCH /admin/stops/stop-id-1
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Parque de la Madre (actualizada)",
  "latitude": -2.8980000
}
```

#### Request body (todos opcionales)

| Campo | Tipo | Validaciones |
|-------|------|--------------|
| `name` | string | No vacio |
| `reference` | string | - |
| `latitude` | number | Min: -90, Max: 90 |
| `longitude` | number | Min: -180, Max: 180 |
| `isActive` | boolean | - |

---

### DELETE /admin/stops/:id

Desactivar una parada (soft delete). Queda con `isActive=false`.

```http
DELETE /admin/stops/stop-id-1
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "id": "stop-id-1",
  "name": "Parque de la Madre",
  "reference": null,
  "latitude": -2.8975,
  "longitude": -79.0045,
  "isActive": false,
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T12:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 404 | Parada no encontrada |

---

## Endpoints de Horarios

### POST /admin/schedules

Crear un nuevo horario para una ruta.

```http
POST /admin/schedules
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "routeId": "550e8400-e29b-41d4-a716-446655440000",
  "dayOfWeek": "MONDAY",
  "direction": "Norte",
  "departureTime": "07:30",
  "approximateArrivalTime": "08:15",
  "status": "ACTIVE"
}
```

#### Request body

| Campo | Tipo | Requerido | Validaciones | Descripcion |
|-------|------|-----------|--------------|-------------|
| `routeId` | string (UUID) | Si | UUID valido | ID de la ruta |
| `dayOfWeek` | string | Si | Enum: `MONDAY` a `SUNDAY` | Dia de la semana |
| `direction` | string | Si | No vacio | Direccion del recorrido |
| `departureTime` | string | Si | Formato `HH:mm` (regex: `^([01]\d\|2[0-3]):([0-5]\d)$`) | Hora de salida |
| `approximateArrivalTime` | string | No | Formato `HH:mm` | Hora estimada de llegada |
| `status` | string | No | Enum: `ACTIVE`, `INACTIVE` | Estado (default: `ACTIVE`) |

#### Response 201

```json
{
  "id": "schedule-id-1",
  "routeId": "550e8400-e29b-41d4-a716-446655440000",
  "dayOfWeek": "MONDAY",
  "direction": "Norte",
  "departureTime": "07:30",
  "approximateArrivalTime": "08:15",
  "status": "ACTIVE",
  "createdAt": "2026-07-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T10:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 400 | Formato de hora invalido (debe ser HH:mm) |
| 400 | UUID invalido para routeId |

---

### GET /admin/schedules

Listar horarios con paginacion y filtros.

```http
GET /admin/schedules?page=1&limit=20&routeId=route-id-1&dayOfWeek=MONDAY
Authorization: Bearer <accessToken>
```

#### Query params

| Param | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `page` | number | No | Numero de pagina (default: 1) |
| `limit` | number | No | Items por pagina (default: 20, max: 100) |
| `routeId` | string (UUID) | No | Filtrar por ruta |
| `dayOfWeek` | string | No | Filtrar por dia: `MONDAY` a `SUNDAY` |

#### Response 200

```json
{
  "data": [
    {
      "id": "schedule-id-1",
      "routeId": "550e8400-e29b-41d4-a716-446655440000",
      "dayOfWeek": "MONDAY",
      "direction": "Norte",
      "departureTime": "07:30",
      "approximateArrivalTime": "08:15",
      "status": "ACTIVE",
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 10,
    "totalPages": 1
  }
}
```

---

### GET /admin/schedules/:id

Obtener detalle de un horario.

```http
GET /admin/schedules/schedule-id-1
Authorization: Bearer <accessToken>
```

---

### PATCH /admin/schedules/:id

Actualizar un horario. Solo se envian los campos a modificar.

```http
PATCH /admin/schedules/schedule-id-1
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "departureTime": "08:00",
  "approximateArrivalTime": "08:45"
}
```

#### Request body (todos opcionales)

| Campo | Tipo | Validaciones |
|-------|------|--------------|
| `routeId` | string (UUID) | UUID valido |
| `dayOfWeek` | string | Enum: `MONDAY` a `SUNDAY` |
| `direction` | string | No vacio |
| `departureTime` | string | Formato `HH:mm` |
| `approximateArrivalTime` | string | Formato `HH:mm` |
| `status` | string | Enum: `ACTIVE`, `INACTIVE` |

---

### DELETE /admin/schedules/:id

Eliminar un horario (borrado fisico).

```http
DELETE /admin/schedules/schedule-id-1
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "id": "schedule-id-1",
  "routeId": "550e8400-e29b-41d4-a716-446655440000",
  "dayOfWeek": "MONDAY",
  "direction": "Norte",
  "departureTime": "07:30",
  "approximateArrivalTime": "08:15",
  "status": "ACTIVE",
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-06-01T10:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 404 | Horario no encontrado |

---

## Endpoints de Vehiculos

### POST /admin/vehicles

Crear un nuevo vehiculo.

```http
POST /admin/vehicles
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "plate": "ABC-1234",
  "code": "V001",
  "capacity": 40,
  "status": "ACTIVE"
}
```

#### Request body

| Campo | Tipo | Requerido | Validaciones | Descripcion |
|-------|------|-----------|--------------|-------------|
| `plate` | string | Si | No vacio | Placa del vehiculo (unica) |
| `code` | string | Si | No vacio | Codigo interno (unico) |
| `capacity` | number | Si | Entero >= 1 | Capacidad de pasajeros |
| `status` | string | No | Enum: `ACTIVE`, `MAINTENANCE`, `INACTIVE` | Estado (default: `ACTIVE`) |

#### Response 201

```json
{
  "id": "vehicle-id-1",
  "plate": "ABC-1234",
  "code": "V001",
  "capacity": 40,
  "status": "ACTIVE",
  "createdAt": "2026-07-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T10:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 409 | Placa o codigo interno ya existen |

---

### GET /admin/vehicles

Listar vehiculos con paginacion.

```http
GET /admin/vehicles?page=1&limit=20
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "data": [
    {
      "id": "vehicle-id-1",
      "plate": "ABC-1234",
      "code": "V001",
      "capacity": 40,
      "status": "ACTIVE",
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 8,
    "totalPages": 1
  }
}
```

---

### GET /admin/vehicles/:id

Obtener detalle de un vehiculo.

```http
GET /admin/vehicles/vehicle-id-1
Authorization: Bearer <accessToken>
```

---

### PATCH /admin/vehicles/:id

Actualizar un vehiculo. Solo se envian los campos a modificar.

```http
PATCH /admin/vehicles/vehicle-id-1
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "capacity": 45,
  "status": "MAINTENANCE"
}
```

#### Request body (todos opcionales)

| Campo | Tipo | Validaciones |
|-------|------|--------------|
| `plate` | string | No vacio |
| `code` | string | No vacio |
| `capacity` | number | Entero >= 1 |
| `status` | string | Enum: `ACTIVE`, `MAINTENANCE`, `INACTIVE` |

#### Errores posibles

| Status | Causa |
|--------|-------|
| 409 | Placa o codigo ya existen en otro vehiculo |

---

### DELETE /admin/vehicles/:id

Desactivar un vehiculo (soft delete). Queda con `status=INACTIVE`.

```http
DELETE /admin/vehicles/vehicle-id-1
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "id": "vehicle-id-1",
  "plate": "ABC-1234",
  "code": "V001",
  "capacity": 40,
  "status": "INACTIVE",
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T12:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 404 | Vehiculo no encontrado |

---

## Endpoints de Conductores

### POST /admin/drivers

Crear un nuevo conductor.

```http
POST /admin/drivers
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Juan Perez",
  "phone": "+593991234567",
  "licenseNumber": "L123456789",
  "status": "ACTIVE",
  "assignedVehicleId": "vehicle-id-1",
  "assignedRouteId": "route-id-1"
}
```

#### Request body

| Campo | Tipo | Requerido | Validaciones | Descripcion |
|-------|------|-----------|--------------|-------------|
| `name` | string | Si | No vacio | Nombre completo del conductor |
| `phone` | string | No | - | Numero de telefono |
| `licenseNumber` | string | No | - | Numero de licencia |
| `status` | string | No | Enum: `ACTIVE`, `INACTIVE` | Estado (default: `ACTIVE`) |
| `assignedVehicleId` | string (UUID) | No | UUID valido | Vehiculo asignado |
| `assignedRouteId` | string (UUID) | No | UUID valido | Ruta asignada |

#### Response 201

```json
{
  "id": "driver-id-1",
  "name": "Juan Perez",
  "phone": "+593991234567",
  "licenseNumber": "L123456789",
  "status": "ACTIVE",
  "assignedVehicleId": "vehicle-id-1",
  "assignedRouteId": "route-id-1",
  "createdAt": "2026-07-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T10:00:00.000Z"
}
```

---

### GET /admin/drivers

Listar conductores con paginacion.

```http
GET /admin/drivers?page=1&limit=20
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "data": [
    {
      "id": "driver-id-1",
      "name": "Juan Perez",
      "phone": "+593991234567",
      "licenseNumber": "L123456789",
      "status": "ACTIVE",
      "assignedVehicleId": "vehicle-id-1",
      "assignedRouteId": "route-id-1",
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPages": 1
  }
}
```

---

### GET /admin/drivers/:id

Obtener detalle de un conductor.

```http
GET /admin/drivers/driver-id-1
Authorization: Bearer <accessToken>
```

---

### PATCH /admin/drivers/:id

Actualizar un conductor. Solo se envian los campos a modificar.

```http
PATCH /admin/drivers/driver-id-1
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "phone": "+593998765432",
  "assignedVehicleId": "vehicle-id-2"
}
```

#### Request body (todos opcionales)

| Campo | Tipo | Validaciones |
|-------|------|--------------|
| `name` | string | No vacio |
| `phone` | string | - |
| `licenseNumber` | string | - |
| `status` | string | Enum: `ACTIVE`, `INACTIVE` |
| `assignedVehicleId` | string (UUID) | UUID valido |
| `assignedRouteId` | string (UUID) | UUID valido |

---

### DELETE /admin/drivers/:id

Desactivar un conductor (soft delete). Queda con `status=INACTIVE`.

```http
DELETE /admin/drivers/driver-id-1
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "id": "driver-id-1",
  "name": "Juan Perez",
  "phone": "+593991234567",
  "licenseNumber": "L123456789",
  "status": "INACTIVE",
  "assignedVehicleId": "vehicle-id-1",
  "assignedRouteId": "route-id-1",
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T12:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 404 | Conductor no encontrado |

---

## Endpoints de Avisos

### POST /admin/notices

Crear un nuevo aviso institucional.

```http
POST /admin/notices
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "title": "Cambio de ruta temporal",
  "message": "La ruta norte tendra un desvio por obras en la Av. 12 de Abril. Se estima duracion de 3 dias.",
  "severity": "WARNING",
  "publishedFrom": "2026-07-01T00:00:00.000Z",
  "publishedUntil": "2026-07-04T23:59:59.000Z",
  "isActive": true
}
```

#### Request body

| Campo | Tipo | Requerido | Validaciones | Descripcion |
|-------|------|-----------|--------------|-------------|
| `title` | string | Si | No vacio | Titulo del aviso |
| `message` | string | Si | No vacio | Mensaje del aviso |
| `severity` | string | No | Enum: `INFO`, `WARNING`, `CRITICAL` | Severidad (default: `INFO`) |
| `publishedFrom` | string (ISO 8601) | Si | Fecha ISO valida | Inicio de publicacion |
| `publishedUntil` | string (ISO 8601) | No | Fecha ISO valida | Fin de publicacion (null = indefinido) |
| `isActive` | boolean | No | - | Si el aviso esta activo (default: `true`) |

#### Response 201

```json
{
  "id": "notice-id-1",
  "title": "Cambio de ruta temporal",
  "message": "La ruta norte tendra un desvio por obras...",
  "severity": "WARNING",
  "publishedFrom": "2026-07-01T00:00:00.000Z",
  "publishedUntil": "2026-07-04T23:59:59.000Z",
  "isActive": true,
  "createdById": "admin-user-id",
  "createdAt": "2026-07-01T10:00:00.000Z",
  "updatedAt": "2026-07-01T10:00:00.000Z"
}
```

---

### GET /admin/notices

Listar avisos con paginacion.

```http
GET /admin/notices?page=1&limit=20
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "data": [
    {
      "id": "notice-id-1",
      "title": "Cambio de ruta temporal",
      "message": "La ruta norte tendra un desvio...",
      "severity": "WARNING",
      "publishedFrom": "2026-07-01T00:00:00.000Z",
      "publishedUntil": "2026-07-04T23:59:59.000Z",
      "isActive": true,
      "createdById": "admin-user-id",
      "createdAt": "2026-06-30T15:00:00.000Z",
      "updatedAt": "2026-06-30T15:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

---

### GET /admin/notices/:id

Obtener detalle de un aviso.

```http
GET /admin/notices/notice-id-1
Authorization: Bearer <accessToken>
```

---

### PATCH /admin/notices/:id

Actualizar un aviso. Solo se envian los campos a modificar.

```http
PATCH /admin/notices/notice-id-1
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "severity": "CRITICAL",
  "publishedUntil": "2026-07-05T23:59:59.000Z"
}
```

#### Request body (todos opcionales)

| Campo | Tipo | Validaciones |
|-------|------|--------------|
| `title` | string | No vacio |
| `message` | string | No vacio |
| `severity` | string | Enum: `INFO`, `WARNING`, `CRITICAL` |
| `publishedFrom` | string (ISO 8601) | Fecha ISO valida |
| `publishedUntil` | string (ISO 8601) | Fecha ISO valida |
| `isActive` | boolean | - |

---

### DELETE /admin/notices/:id

Desactivar un aviso (soft delete). Queda con `isActive=false`.

```http
DELETE /admin/notices/notice-id-1
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "id": "notice-id-1",
  "title": "Cambio de ruta temporal",
  "message": "La ruta norte tendra un desvio por obras.",
  "severity": "INFO",
  "publishedFrom": "2026-06-29T00:00:00.000Z",
  "publishedUntil": null,
  "isActive": false,
  "createdBy": {
    "id": "admin-id-1",
    "email": "admin@ups.edu.ec",
    "name": "Administrador"
  },
  "createdAt": "2026-06-29T00:00:00.000Z",
  "updatedAt": "2026-07-01T12:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 404 | Aviso no encontrado |

---

## Resumen de endpoints administrativos

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/admin/routes` | Crear ruta |
| GET | `/admin/routes` | Listar rutas |
| GET | `/admin/routes/:id` | Detalle ruta |
| PATCH | `/admin/routes/:id` | Actualizar ruta |
| PATCH | `/admin/routes/:id/stops/order` | Ordenar paradas de ruta |
| DELETE | `/admin/routes/:id` | Desactivar ruta (soft delete) |
| POST | `/admin/stops` | Crear parada |
| GET | `/admin/stops` | Listar paradas |
| GET | `/admin/stops/:id` | Detalle parada |
| PATCH | `/admin/stops/:id` | Actualizar parada |
| DELETE | `/admin/stops/:id` | Desactivar parada (soft delete) |
| POST | `/admin/schedules` | Crear horario |
| GET | `/admin/schedules` | Listar horarios |
| GET | `/admin/schedules/:id` | Detalle horario |
| PATCH | `/admin/schedules/:id` | Actualizar horario |
| DELETE | `/admin/schedules/:id` | Eliminar horario (borrado fisico) |
| POST | `/admin/vehicles` | Crear vehiculo |
| GET | `/admin/vehicles` | Listar vehiculos |
| GET | `/admin/vehicles/:id` | Detalle vehiculo |
| PATCH | `/admin/vehicles/:id` | Actualizar vehiculo |
| DELETE | `/admin/vehicles/:id` | Desactivar vehiculo (soft delete) |
| POST | `/admin/drivers` | Crear conductor |
| GET | `/admin/drivers` | Listar conductores |
| GET | `/admin/drivers/:id` | Detalle conductor |
| PATCH | `/admin/drivers/:id` | Actualizar conductor |
| DELETE | `/admin/drivers/:id` | Desactivar conductor (soft delete) |
| POST | `/admin/notices` | Crear aviso |
| GET | `/admin/notices` | Listar avisos |
| GET | `/admin/notices/:id` | Detalle aviso |
| PATCH | `/admin/notices/:id` | Actualizar aviso |
| DELETE | `/admin/notices/:id` | Desactivar aviso (soft delete) |

---

## Enums de referencia

### RouteStatus
```
ACTIVE | SUSPENDED | INACTIVE
```

### ScheduleStatus
```
ACTIVE | INACTIVE
```

### VehicleStatus
```
ACTIVE | MAINTENANCE | INACTIVE
```

### DriverStatus
```
ACTIVE | INACTIVE
```

### NoticeSeverity
```
INFO | WARNING | CRITICAL
```

### DayOfWeek
```
MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY
```

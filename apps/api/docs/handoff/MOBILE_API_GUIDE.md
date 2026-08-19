# Guia de API para App Movil (Expo)

Esta guia documenta los endpoints que consume la app movil de UPS ExpresosApp. Todos los endpoints requieren autenticacion JWT en el header `Authorization: Bearer <accessToken>`.

## Autenticacion

Todos los endpoints de esta guia requieren:

```http
Authorization: Bearer <accessToken>
```

**Roles permitidos:** `STUDENT`, `DRIVER`, `ADMIN`, `SUPER_ADMIN`

Para obtener tokens, consulta [`AUTH_FLOW.md`](./AUTH_FLOW.md).

---

## Endpoints de Rutas

### GET /mobile/routes

Lista de rutas disponibles con paginacion y filtros.

```http
GET /mobile/routes?page=1&limit=20&status=ACTIVE&search=Norte
Authorization: Bearer <accessToken>
```

#### Query params

| Param | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `page` | number | No | Numero de pagina (default: 1, minimo: 1) |
| `limit` | number | No | Items por pagina (default: 20, max: 100) |
| `status` | string | No | Filtrar por estado: `ACTIVE`, `SUSPENDED`, `INACTIVE` |
| `search` | string | No | Buscar por nombre o direccion de ruta |

#### Response 200

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Norte - Salesiana",
      "description": "Ruta que cubre el norte de la ciudad hacia el campus Salesiana",
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

#### Pantalla sugerida
Lista principal de rutas con buscador y filtro por estado.

---

### GET /mobile/routes/:id

Detalle de una ruta con paradas ordenadas y horarios activos embebidos.

```http
GET /mobile/routes/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <accessToken>
```

#### Path params

| Param | Tipo | Descripcion |
|-------|------|-------------|
| `id` | string (UUID) | ID de la ruta |

#### Response 200

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Norte - Salesiana",
  "description": "Ruta que cubre el norte de la ciudad",
  "direction": "Norte",
  "status": "ACTIVE",
  "isActive": true,
  "stops": [
    {
      "id": "route-stop-id-1",
      "stopId": "stop-id-1",
      "stopOrder": 1,
      "estimatedArrivalMinutes": 0,
      "notes": "Punto de partida",
      "stop": {
        "id": "stop-id-1",
        "name": "Parque de la Madre",
        "reference": "Av. 12 de Abril y Loja",
        "latitude": -2.8975000,
        "longitude": -79.0045000,
        "isActive": true
      }
    },
    {
      "id": "route-stop-id-2",
      "stopId": "stop-id-2",
      "stopOrder": 2,
      "estimatedArrivalMinutes": 15,
      "notes": null,
      "stop": {
        "id": "stop-id-2",
        "name": "Redondel de la Circunvalacion",
        "reference": "Av. Circunvalacion",
        "latitude": -2.8850000,
        "longitude": -79.0100000,
        "isActive": true
      }
    }
  ],
  "schedules": [
    {
      "id": "schedule-id-1",
      "routeId": "550e8400-e29b-41d4-a716-446655440000",
      "dayOfWeek": "MONDAY",
      "direction": "Norte",
      "departureTime": "07:30",
      "approximateArrivalTime": "08:15",
      "status": "ACTIVE"
    }
  ],
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-06-15T14:30:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 404 | Ruta no encontrada |

#### Pantalla sugerida
Detalle de ruta con mapa de paradas y lista de horarios.

---

### GET /mobile/routes/:id/stops

Lista de paradas ordenadas para una ruta especifica.

```http
GET /mobile/routes/550e8400-e29b-41d4-a716-446655440000/stops
Authorization: Bearer <accessToken>
```

#### Response 200

```json
[
  {
    "id": "route-stop-id-1",
    "stopId": "stop-id-1",
    "stopOrder": 1,
    "estimatedArrivalMinutes": 0,
    "notes": "Punto de partida",
    "stop": {
      "id": "stop-id-1",
      "name": "Parque de la Madre",
      "reference": "Av. 12 de Abril y Loja",
      "latitude": -2.8975000,
      "longitude": -79.0045000,
      "isActive": true
    }
  },
  {
    "id": "route-stop-id-2",
    "stopId": "stop-id-2",
    "stopOrder": 2,
    "estimatedArrivalMinutes": 15,
    "notes": null,
    "stop": {
      "id": "stop-id-2",
      "name": "Redondel de la Circunvalacion",
      "reference": "Av. Circunvalacion",
      "latitude": -2.8850000,
      "longitude": -79.0100000,
      "isActive": true
    }
  }
]
```

#### Notas
- Las paradas vienen ordenadas por `stopOrder` ascendente
- Cada item incluye el objeto `stop` completo con coordenadas GPS
- `estimatedArrivalMinutes` es el tiempo estimado desde el inicio de la ruta

#### Pantalla sugerida
Mapa con marcadores de paradas o lista numerada de paradas.

---

### GET /mobile/routes/:id/schedules

Horarios activos para una ruta, con filtros opcionales.

```http
GET /mobile/routes/550e8400-e29b-41d4-a716-446655440000/schedules?dayOfWeek=MONDAY&direction=Norte
Authorization: Bearer <accessToken>
```

#### Query params

| Param | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `dayOfWeek` | string | No | Filtrar por dia: `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY` |
| `direction` | string | No | Filtrar por direccion (ej: "Norte") |

#### Response 200

```json
[
  {
    "id": "schedule-id-1",
    "routeId": "550e8400-e29b-41d4-a716-446655440000",
    "dayOfWeek": "MONDAY",
    "direction": "Norte",
    "departureTime": "07:30",
    "approximateArrivalTime": "08:15",
    "status": "ACTIVE"
  },
  {
    "id": "schedule-id-2",
    "routeId": "550e8400-e29b-41d4-a716-446655440000",
    "dayOfWeek": "MONDAY",
    "direction": "Norte",
    "departureTime": "13:00",
    "approximateArrivalTime": "13:45",
    "status": "ACTIVE"
  }
]
```

#### Pantalla sugerida
Tabla de horarios agrupados por dia de la semana.

---

## Endpoints de Avisos

### GET /mobile/notices

Lista de avisos institucionales activos (publicados actualmente).

```http
GET /mobile/notices?page=1&limit=20
Authorization: Bearer <accessToken>
```

#### Query params

| Param | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `page` | number | No | Numero de pagina (default: 1) |
| `limit` | number | No | Items por pagina (default: 20, max: 100) |

#### Response 200

```json
{
  "data": [
    {
      "id": "notice-id-1",
      "title": "Cambio de ruta temporal",
      "message": "La ruta norte tendra un desvio por obras en la Av. 12 de Abril. Se estima duracion de 3 dias.",
      "severity": "WARNING",
      "publishedFrom": "2026-07-01T00:00:00.000Z",
      "publishedUntil": "2026-07-04T23:59:59.000Z",
      "isActive": true,
      "createdAt": "2026-06-30T15:00:00.000Z",
      "updatedAt": "2026-06-30T15:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### Notas
- Solo retorna avisos donde `publishedFrom <= now` y (`publishedUntil >= now` o `publishedUntil` es null)
- Solo retorna avisos con `isActive: true`
- Severidades: `INFO`, `WARNING`, `CRITICAL`

#### Pantalla sugerida
Seccion de avisos/notificaciones con iconos segun severidad.

---

## Endpoints de Feedback de Viaje

### POST /trip-feedback

Crear un nuevo feedback de viaje (calificar un viaje realizado).

```http
POST /trip-feedback
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "routeId": "550e8400-e29b-41d4-a716-446655440000",
  "driverId": "driver-id-1",
  "rating": 4,
  "comment": "El servicio fue puntual y comodo",
  "travelDate": "2026-07-01T08:00:00.000Z"
}
```

#### Request body

| Campo | Tipo | Requerido | Validaciones | Descripcion |
|-------|------|-----------|--------------|-------------|
| `routeId` | string (UUID) | Si | UUID valido | ID de la ruta calificada |
| `driverId` | string (UUID) | No | UUID valido | ID del conductor (opcional) |
| `rating` | number | Si | Entero entre 1 y 5 | Calificacion del viaje |
| `comment` | string | No | - | Comentario opcional |
| `travelDate` | string (ISO 8601) | No | Formato ISO 8601 | Fecha del viaje |

#### Response 201

```json
{
  "id": "feedback-id-1",
  "userId": "user-id-1",
  "routeId": "550e8400-e29b-41d4-a716-446655440000",
  "driverId": "driver-id-1",
  "rating": 4,
  "comment": "El servicio fue puntual y comodo",
  "travelDate": "2026-07-01T08:00:00.000Z",
  "createdAt": "2026-07-01T10:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 400 | Rating fuera de rango (1-5) |
| 400 | UUIDs invalidos |
| 404 | Ruta o conductor no encontrado |

#### Pantalla sugerida
Formulario de calificacion despues de completar un viaje, con estrellas (1-5) y campo de comentario.

---

### GET /trip-feedback

Lista paginada de feedbacks con filtros opcionales.

```http
GET /trip-feedback?page=1&limit=20&userId=user-id-1&routeId=route-id-1
Authorization: Bearer <accessToken>
```

#### Query params

| Param | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `page` | number | No | Numero de pagina (default: 1) |
| `limit` | number | No | Items por pagina (default: 20) |
| `userId` | string (UUID) | No | Filtrar por usuario |
| `routeId` | string (UUID) | No | Filtrar por ruta |

#### Response 200

```json
{
  "data": [
    {
      "id": "feedback-id-1",
      "userId": "user-id-1",
      "routeId": "550e8400-e29b-41d4-a716-446655440000",
      "driverId": "driver-id-1",
      "rating": 4,
      "comment": "El servicio fue puntual y comodo",
      "travelDate": "2026-07-01T08:00:00.000Z",
      "createdAt": "2026-07-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### Pantalla sugerida
Historial de feedbacks enviados por el usuario.

---

### GET /trip-feedback/:id

Detalle de un feedback especifico.

```http
GET /trip-feedback/feedback-id-1
Authorization: Bearer <accessToken>
```

#### Response 200

```json
{
  "id": "feedback-id-1",
  "userId": "user-id-1",
  "routeId": "550e8400-e29b-41d4-a716-446655440000",
  "driverId": "driver-id-1",
  "rating": 4,
  "comment": "El servicio fue puntual y comodo",
  "travelDate": "2026-07-01T08:00:00.000Z",
  "createdAt": "2026-07-01T10:00:00.000Z"
}
```

#### Errores posibles

| Status | Causa |
|--------|-------|
| 404 | Feedback no encontrado |

---

## Resumen de endpoints moviles

| Metodo | Ruta | Descripcion | Pantalla |
|--------|------|-------------|----------|
| GET | `/mobile/routes` | Listar rutas con filtros | Lista de rutas |
| GET | `/mobile/routes/:id` | Detalle de ruta con paradas y horarios | Detalle de ruta |
| GET | `/mobile/routes/:id/stops` | Paradas ordenadas de una ruta | Mapa / Lista de paradas |
| GET | `/mobile/routes/:id/schedules` | Horarios de una ruta con filtros | Tabla de horarios |
| GET | `/mobile/notices` | Avisos institucionales activos | Seccion de avisos |
| POST | `/trip-feedback` | Crear feedback de viaje | Formulario de calificacion |
| GET | `/trip-feedback` | Listar feedbacks con filtros | Historial de feedbacks |
| GET | `/trip-feedback/:id` | Detalle de un feedback | Detalle de feedback |

---

## Enums de referencia

### RouteStatus
```
ACTIVE | SUSPENDED | INACTIVE
```

### DayOfWeek
```
MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY
```

### NoticeSeverity
```
INFO | WARNING | CRITICAL
```

### UserRole
```
STUDENT | ADMIN | SUPER_ADMIN | DRIVER
```

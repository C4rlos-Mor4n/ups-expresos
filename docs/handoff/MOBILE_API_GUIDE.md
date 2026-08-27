# Mobile API Guide — UPS ExpresosApp

Guía para la app móvil (`apps/mobile`) de la Fase 1 — Route Operations. Todos los endpoints requieren `Authorization: Bearer <accessToken>`.

## Rutas y estado operativo

### `GET /mobile/routes`

Lista rutas activas con su estado operativo actual.

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Terminal Río Daule → Campus Centenario",
      "description": "...",
      "direction": "IDA",
      "status": "ACTIVE",
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "...",
      "currentOperation": {
        "status": "IN_PROGRESS",
        "driver": { "id": "uuid", "name": "Juan Pérez" },
        "vehicle": { "id": "uuid", "plate": "GXX-1234", "code": "BUS-01" },
        "startedAt": "2026-08-25T12:00:00.000Z",
        "tripId": "uuid"
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 7, "totalPages": 1 }
}
```

Query params: `page`, `limit`, `status`, `search`.

`currentOperation` es `null` cuando la ruta no tiene operación activa **para el día actual**. Criterio (Opción B documentada):

1. Si existe un `Trip` `IN_PROGRESS` para la ruta → `currentOperation` refleja `IN_PROGRESS` con conductor, vehículo, `startedAt` y `tripId`.
2. Si no hay trip en progreso pero existe una **asignación activa de hoy** → refleja el estado de esa asignación (`SCHEDULED` o `COMPLETED`) con su conductor y vehículo.
3. Si no hay operación de hoy → `null`.

> Nota: el "día de hoy" se calcula con la zona horaria del servidor. Las asignaciones de días pasados no se muestran como operación actual.

### `GET /mobile/routes/:id`

Detalle de ruta:

```json
{
  "route": { "id": "uuid", "name": "...", "direction": "IDA", "status": "ACTIVE", ... },
  "stops": [ { "stopOrder": 0, "estimatedArrivalMinutes": null, "stop": { "id": "uuid", "name": "...", "latitude": -2.14, "longitude": -79.88, ... } } ],
  "schedules": [ { "dayOfWeek": "MONDAY", "direction": "IDA", "departureTime": "07:30", ... } ],
  "currentOperation": { "status": "IN_PROGRESS", "driver": {...}, "vehicle": {...}, "startedAt": "...", "tripId": "uuid" }
}
```

`currentOperation` puede ser `null`.

### Endpoints de lectura existentes

- `GET /mobile/routes/:id/stops` — paradas ordenadas
- `GET /mobile/routes/:id/schedules?dayOfWeek=&direction=` — horarios activos
- `GET /mobile/notices` — avisos activos

## Estados para mostrar al estudiante

| `TripStatus` | Qué mostrar |
|---|---|
| `SCHEDULED` | Programado (con conductor/vehículo asignados si existen) |
| `IN_PROGRESS` | En recorrido (con conductor, vehículo y hora de inicio) |
| `COMPLETED` | Finalizado |
| `CANCELLED` | Cancelado |
| `SUSPENDED` | Suspendido |

## Qué NO está disponible en esta fase

- Tracking GPS / ubicación del bus en tiempo real.
- ETA dinámico.
- Notificaciones push.

## Credenciales demo (conductor)

- Usuario: `conductor.portal1@ups.edu.ec` (vinculado a Luis Herrera, BUS-001).
- Usuario: `conductor.portal2@ups.edu.ec` (vinculado a María Paredes, BUS-002).

Flujo: `POST /auth/request-code` → recibir OTP → `POST /auth/verify-code` → usar accessToken.

## Especificación OpenAPI

`docs/handoff/ups-expresosapp-openapi.json`.
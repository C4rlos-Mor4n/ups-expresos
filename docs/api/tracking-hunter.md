# Tracking en tiempo real — Hunter DataForward (implementado)

UPS GO muestra la ubicación real de los buses usando la plataforma AVL de **Hunter**. Hunter envía cada
reporte/alerta de los GPS instalados en los buses mediante `HTTP POST` (DataForward) a la API; la API los
valida, normaliza, guarda y los expone a las apps **en contexto del servicio** (salida → asignación → recorrido).

```text
GPS del bus ──► Hunter AVL ──HTTP POST──► /integrations/hunter/dataforward
                                             │  token + (IP allowlist)
                                             ▼
                                   normalización (hunter-payload.ts)
                                             │  mph→km/h, FechaHora UTC, Rumbo, CalidadGPS
                                             ▼
                              TrackingService.ingest (idempotente)
                         ┌───────────────────┴───────────────────┐
              tracking_devices (última posición)       tracking_points (historial, N días)
                         │
          ┌──────────────┼───────────────────────────┐
  Student /live     Driver /live              Admin /admin/tracking/*
  (mapa en la app)  (GPS del bus)             (vincular GPS, flota, alertas, trayecto)
                         │
            OperationsAutoRunService (opcional: inicio/cierre automático)
```

Código: `apps/api/src/modules/tracking/`. Migración: `20261015050017_add_vehicle_tracking` (solo aditiva).

## 1. Recepción (webhook)

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/integrations/hunter/dataforward` | Una sola URL para eventos y alertas (se detecta por `Id` / `IdActivo`). |
| `POST` | `/integrations/hunter/dataforward/events` | Solo eventos (rechaza alertas). |
| `POST` | `/integrations/hunter/dataforward/alerts` | Solo alertas (rechaza eventos). |

- **Autenticación: API key** `HUNTER_WEBHOOK_TOKEN` (≥ 24 caracteres, comparación en tiempo constante) en el header
  **`X-API-Key`**. También se acepta `Authorization: Bearer <key>` o `?api_key=<key>` si Hunter solo permite configurar
  una URL. Sin API key configurada el endpoint responde **503**.
- **Solo lo que Hunter documenta**: cualquier campo fuera de la lista del PDF (evento, alerta y CAN), objetos o
  listas anidadas, textos de más de 300 caracteres, coordenadas fuera de rango, `FechaHora` futura (> 10 min) o de hace
  más de 7 días → **400** y no se guarda nada. Máximo 50 reportes por POST y cuerpo ≤ 256 KB.
- **IP allowlist** opcional: `HUNTER_ALLOWED_IPS` (con gateway + ngrok, `TRUST_PROXY_HOPS=2`).
- Límite propio de 1200 solicitudes/min (toda la flota llega desde Hunter); no usa JWT de usuarios.
- Acepta `application/json` y también `text/*` (por si Hunter no envía `Content-Type`), un objeto o una lista
  (máx. 200 por POST).
- Respuestas: `200 {"received","accepted","duplicates"}` · `400` payload inválido (no reintentar) ·
  `401` API key inválida · `403` IP no permitida · `503` integración no configurada.

**URL para entregar a Hunter** (ambiente de pruebas actual):
`https://<dominio-api>/integrations/hunter/dataforward` con el header `X-API-Key: <HUNTER_WEBHOOK_TOKEN>`

### Normalización (`hunter/hunter-payload.ts`, funciones puras con tests)

| Hunter | UPS GO | Regla |
|---|---|---|
| `FechaHora` `yyyyMMdd HH:mm:ss` (UTC) | `occurredAt` | También acepta ISO-8601 con zona. Fechas imposibles → 400. |
| `Id` (evento) / `IdActivo` (alerta) | `externalId` | Texto (no número) para no perder precisión. |
| `AliasEtiqueta` `"ALIAS/ETIQUETA"` / `Alias`+`Etiqueta` | `alias`, `label` | |
| `Velocidad` (mph) | `speedKph` | `mph × 1.609344`, redondeo a 2 decimales. Se guarda el payload original en `raw`. |
| `Rumbo` 0–360 | `heading` | `0` = detenido → `null`; `360` (norte) → `0`. |
| `CalidadGPS` / `EstadoGPS` | `gpsQuality` | `9` = sin GPS → el punto se guarda pero **no** mueve la última posición. Coordenadas `0,0` igual. |
| `EstadoIgnicion` 0/1 | `ignition` | |
| `Evento`, `Suceso` | `eventCode`, `occurrenceCode` | Catálogo de sucesos del PDF (1–35, 1000–1006, 2000–2003). |
| `Descripcion` (alerta) | `description` | |

**Idempotencia**: `tracking_points` tiene `UNIQUE(deviceId, dedupKey)` con
`dedupKey = tipo|occurredAt|Evento|Suceso|Descripcion`; un reenvío de Hunter no duplica.
**Fuera de orden**: la última posición del dispositivo solo avanza si el reporte es más nuevo
(`lastOccurredAt`); los atrasados quedan en el historial.

## 2. Modelo de datos

- `TrackingDevice` — un equipo AVL por `(provider, externalId)`. Se crea solo al llegar su primer reporte.
  `vehicleId` (único, opcional) lo vincula a un `Vehicle`; guarda la **última posición** (`last*`) para lecturas
  rápidas. Desacoplado del proveedor (`TrackingProvider` = `HUNTER`; se pueden agregar otros).
- `TrackingPoint` — historial normalizado (`EVENT`/`ALERT`) con `raw` JSON para diagnóstico. Se purga cada hora
  lo más antiguo que `TRACKING_HISTORY_DAYS`.
- `ServiceRun.startSource` / `completionSource` (`DRIVER` | `SYSTEM`) — quién inició/cerró el recorrido.

Redis **no** se introdujo: con decenas de buses y polling cada 10 s, PostgreSQL (fila por dispositivo con la
última posición) basta. Si la flota o la frecuencia crecen, mover la última posición a Redis es un cambio local
en `TrackingService`.

## 3. Lo que ven las apps

Regla central: **la posición no define el estado operativo**. El estudiante solo ve el bus:

- `IN_PROGRESS`: recorrido iniciado (por el conductor o automáticamente);
- `BEFORE_START`: asignado y desde **30 min antes** de la salida planificada hasta su fin planificado
  ("Aún no inicia el recorrido");
- nunca fuera de esa ventana ni con el recorrido completado (`NOT_LIVE`).

Frescura (configurable, la frecuencia real de Hunter está por confirmar):
`LIVE` ≤ `TRACKING_LIVE_SECONDS` (120) · `STALE` ≤ `TRACKING_STALE_SECONDS` (900) → "Última ubicación conocida" ·
más antiguo → `NO_SIGNAL`, no se dibuja.

| Endpoint | Rol | Respuesta |
|---|---|---|
| `GET /student/scheduled-departures/:id/live` | STUDENT | `DepartureLiveDto`: buses de la salida con `phase`, `tracking.status` (`AVAILABLE`, `NO_DEVICE`, `NO_SIGNAL`, `NOT_LIVE`) y `position` (lat, lng, km/h, rumbo, antigüedad, frescura). `refreshAfterSeconds`: 10 con bus en vivo, 60 si no. |
| `GET /driver/operational/assignments/:id/live` | DRIVER (dueño) | `LiveBusDto` del bus del conductor (lo ve aunque falten más de 30 min). |

Nunca se expone el payload crudo de Hunter (calle, voltajes, odómetro, CAN) a estudiantes.

**App (Expo)**: `LiveBusSection` en el detalle de salida (mapa Leaflet + OpenStreetMap dentro de
`react-native-webview`, paradas y bus con rumbo, botones "ver bus"/"ver recorrido") y `DriverGpsCard` en el
detalle del servicio y el recorrido en curso del conductor. Actualización por **polling** (`useLivePolling`),
que respeta `refreshAfterSeconds` y se pausa con la app en segundo plano. Se eligió polling y no WebSocket/SSE
porque funciona detrás de ngrok/proxies, no requiere infraestructura adicional y los GPS reportan cada varios
segundos. La línea entre paradas es **referencial** (no hay geometría de calles).

## 4. Administración (panel web → sección GPS y Monitoreo en vivo)

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/admin/tracking/devices` | Equipos reportando (vinculados y sin vincular) con su última posición. |
| `PUT` | `/admin/tracking/devices/:id/vehicle` | `{ "vehicleId": "<uuid>" }` vincula; `null` desvincula. 409 si el bus ya tiene otro equipo. Auditado. |
| `PATCH` | `/admin/tracking/devices/:id` | `{ "isActive": false }` deja de usar un equipo sin borrarlo. |
| `GET` | `/admin/tracking/fleet` | Flota en vivo: bus, posición, frescura y recorrido en curso (línea, hora, conductor, origen del inicio). |
| `GET` | `/admin/tracking/alerts?hours=24` | Alertas Hunter + eventos críticos (pánico, exceso de velocidad, pérdida de GPS, jamming, impactos, maniobras violentas). |
| `GET` | `/admin/tracking/vehicles/:vehicleId/trail?from=&to=` | Trayecto histórico (máx. 24 h, 5000 puntos). |

**Alta de un bus con GPS**: Hunter configura la URL → el equipo envía su primer reporte → aparece en
`/admin/tracking/devices` con su `externalId`/alias → la administración lo vincula al `Vehicle` correspondiente.

## 5. Operación automática de recorridos (opcional)

`OPERATIONS_AUTO_RUN` (por defecto `off`), revisado cada 60 s por `OperationsAutoRunService`:

| Modo | Inicio automático | Cierre automático |
|---|---|---|
| `off` | No (solo el conductor). | No. |
| `schedule` | A la hora planificada (hasta `OPERATIONS_AUTO_START_GRACE_MINUTES` después), aunque no haya GPS. | Sí. |
| `schedule_with_gps` | A la hora planificada **solo si** el GPS del bus está `LIVE` y con ignición encendida o en movimiento (≥ 5 km/h). | Sí. |

- El cierre automático completa los recorridos que siguen abiertos `OPERATIONS_AUTO_FINISH_AFTER_MINUTES`
  después de su fin planificado (evita recorridos "olvidados").
- El conductor siempre puede iniciar antes o finalizar él mismo; el sistema respeta los mismos bloqueos
  (conductor/bus con otro recorrido activo → no inicia).
- Los inicios/cierres del sistema quedan auditados (`SERVICE_RUN_AUTO_START` / `SERVICE_RUN_AUTO_FINISH`) y la
  app muestra "iniciado automáticamente".
- Nunca se infiere un recorrido **solo** por GPS fuera de su ventana planificada.

Recomendación: `schedule_with_gps` cuando todos los buses tengan GPS vinculado y la frecuencia de Hunter esté
confirmada; mientras tanto `off` (o `schedule` si se quiere que el estado cambie a la hora aunque el conductor
no use la app).

## 6. Pruebas y simulador

- Unitarios: `hunter-payload.spec.ts` (ejemplos literales del PDF), `tracking-rules.spec.ts` (frescura, ventana,
  reglas de inicio automático).
- E2E: `test/e2e/tracking.e2e-spec.ts` — token, payloads inválidos, idempotencia, vinculación, vista del
  estudiante y del conductor, reporte atrasado, inicio y cierre automáticos, alertas, trayecto, permisos.
- **Simulador** (QA/demo, sin equipos reales): mueve un bus por las paradas de un recorrido del dataset.

```bash
cd apps/api
pnpm tracking:simulate -- --url https://<api> --token <HUNTER_WEBHOOK_TOKEN> \
  --route NORTE_IDA --device 900001 --alias GBA1234 --interval 5 --steps 8
# en el contenedor: node dist/scripts/hunter-simulate.js --url http://localhost:3000 --token ...
```

Luego vincular el dispositivo `900001` a un bus y abrir en la app una salida asignada a ese bus.

## 7. Pendiente de confirmar con Hunter

El código tolera estas dudas, pero deben cerrarse antes de producción:

- Versión contractual: el archivo dice **V1.3.0**, el pie **V1.2.0**.
- `FechaHora`: el PDF dice `HH:mm:dd`, el ejemplo muestra segundos (implementado como `HH:mm:ss`, UTC).
- `Suceso: 0` en el ejemplo, ausente en la tabla.
- `Id` (evento) vs `IdActivo` (alerta): implementado asumiendo que identifican al mismo equipo; si no, cada uno
  aparecerá como un dispositivo distinto en `/admin/tracking/devices`.
- Confirmar que Hunter puede enviar el header `X-API-Key` (si no, usar `?api_key=` en la URL) y si tienen IP fijas.
- Timeout, códigos que consideran ACK y política de reintentos (UPS GO responde 200 rápido; 400 = no reintentar).
- Frecuencia de reporte (con ignición encendida/apagada) para ajustar `TRACKING_LIVE_SECONDS`.
- Valores de `CalidadGPS`/`EstadoGPS` además de 1 y 9; si la velocidad llega siempre en mph.
- Sandbox o envío de payloads de prueba; campos CAN disponibles en los buses UPS.
- Tiles del mapa: se usan los de OpenStreetMap (con atribución). Para producción con muchos usuarios conviene
  un proveedor de tiles con clave (MapTiler, Stadia, Mapbox) por la política de uso de OSM.

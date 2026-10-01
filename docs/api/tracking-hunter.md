# Plan de integración GPS — Hunter DataForward (futuro)

> **Estado: no implementado.** Este documento es el plan de diseño y la lista de preguntas abiertas.
> No se debe congelar el esquema de tracking antes de recibir las respuestas de Hunter.

Hunter operará el servicio AVL/GPS de los buses y entregó la definición de **DataForward**
("Definición de servicio de replicación de datos AVL — Eventos / Alertas"). Cuando su plataforma recibe un evento o
alerta de un dispositivo, hace un `HTTP POST` a una URL parametrizada: Hunter es un proveedor *push/webhook*; UPS GO
no necesita consultar posiciones.

```text
GPS del bus → Hunter AVL → HTTP POST (DataForward) → UPS GO → normalización → última posición → tiempo real → Student / Admin
```

## Lo que documenta el PDF

- **Evento**: `AliasEtiqueta`, `FechaHora` (UTC), `Id` (dispositivo), `Evento`, `Suceso` (código numérico), `Latitud`, `Longitud`,
  `Calle`, `NumeroSatelites`, `CalidadGPS` (1 = excelente, 9 = sin GPS), `EstadoIgnicion`, `Velocidad` (**millas por hora**),
  `Rumbo` (0–360), `Altitud` (m), voltajes/baterías, `Odometro`, `Horometro` y campos CAN opcionales.
- **Alerta**: como el evento, con `IdActivo`, `Alias`, `Etiqueta`, `Descripcion` y `EstadoGPS` en lugar de `Id`, `AliasEtiqueta` y `CalidadGPS`.
- Catálogo de sucesos (1–35, 1000–1006, 2000–2003): encendido/apagado, batería, pánico, exceso de velocidad, pérdida de GPS,
  impacto, frenado/aceleración violentos, etc.
- Campos CAN opcionales (RPM, combustible, DTC, check engine…): útiles para mantenimiento, **fuera del primer alcance**.

## Inconsistencias a confirmar con Hunter

- Versión del documento: el archivo dice **V1.3.0**, el pie de página **V1.2.0**.
- `FechaHora` se describe como `yyyyMMdd HH:mm:dd`; el ejemplo sugiere `yyyyMMdd HH:mm:ss`. No corregir en silencio.
- Ejemplo con `Suceso: 0`, ausente en la tabla (empieza en 1).
- `Id` (evento) vs `IdActivo` (alerta): no asumir que son el mismo identificador.
- El PDF **no** especifica autenticación del webhook (API key, HMAC, Basic, mTLS, IP allowlist).

## Preguntas bloqueantes para Hunter

1. ¿Versión contractual vigente (1.2.0 o 1.3.0)? ¿Formato real de `FechaHora`? ¿Es exactamente UTC?
2. ¿Eventos y Alertas pueden usar URLs distintas?
3. ¿Cómo autentican el POST (firma HMAC, token/header, IP fijas, mTLS)?
4. Timeout esperado, código HTTP considerado ACK, política de reintentos (cantidad, backoff) ante 4xx/5xx/timeout.
5. ¿Pueden duplicar eventos? ¿Existe un ID único por evento? ¿Pueden llegar fuera de orden?
6. ¿Qué identificador mapea a cada bus (IMEI, `Id`, `IdActivo`, alias, etiqueta)? ¿Qué significa `Suceso = 0`?
7. Frecuencia de "Reporte de posición" (¿configurable a 5/10/15/30 s?), con ignición apagada, y reenvío al recuperar conectividad
   conservando el timestamp original.
8. Valores posibles de `CalidadGPS`/`EstadoGPS` además de 1 y 9; ¿la velocidad siempre llega en mph?
9. ¿Existe sandbox y payloads de prueba bajo demanda? Volumen máximo estimado por bus/día.
10. ¿Qué campos CAN estarán realmente disponibles en los buses UPS?

## Arquitectura propuesta (recomendación de UPS GO)

```text
POST /integrations/hunter/dataforward[/events|/alerts]
  → controlador del webhook (autenticación server-to-server propia, no JWT)
  → validación estricta del payload
  → adaptador Hunter → modelo canónico (una sola conversión mph → km/h; el valor crudo no se altera)
  → deduplicación / idempotencia
  → servicio de tracking: binding Vehicle ↔ dispositivo, última posición (Redis), historial mínimo (PostgreSQL)
  → correlación con ServiceAssignment / ServiceRun
  → pasarela de tiempo real (WebSocket o SSE) → Admin Web y Student
```

Principios:

- **Desacoplar el proveedor**: nada de campos Hunter dentro de `Vehicle`. Tabla de *binding* (`vehicleId`, proveedor,
  `externalDeviceId`, alias, activo) y puntos normalizados (`occurredAt`, `receivedAt`, lat/lng, `speedKph`, rumbo,
  calidad GPS, ignición, códigos de evento). Política de retención para el JSON crudo.
- **El GPS no reemplaza al `ServiceRun`**. Un bus con telemetría pero sin `ServiceRun IN_PROGRESS` no se muestra como "en ruta".
  El inicio del recorrido sigue siendo explícito del conductor.
- **Nunca** exponer el payload de Hunter a la app: se publica un contrato canónico
  (`vehicleId`, `serviceAssignmentId`, `serviceRunId`, coordenadas, `speedKph`, `headingDegrees`, `occurredAt`, `receivedAt`, `stale`).
- **Vigencia**: estados `LIVE`, `STALE`, `OFFLINE`; los umbrales se fijan al conocer la frecuencia real de reporte.
- **Redis** (`tracking:last:<vehicleId>`) para última posición y pub/sub; PostgreSQL no se consulta por cada estudiante.
- **ETA**: no en la primera fase. Primero posición real + estado real; después heurística con recorrido e histórico.
- **Alertas** (pánico, exceso de velocidad, jamming…) son para Admin y van después del mapa.

## Fases propuestas

| Fase | Contenido |
|---|---|
| 9A | Contrato e ingestión: autenticación del webhook, DTOs, normalización, mapeo dispositivo-bus, idempotencia, pruebas. |
| 9B | Estado de tracking: binding, última posición en Redis, historial mínimo, stale/offline. |
| 9C | Pasarela de tiempo real (WebSocket/SSE), suscripciones, autorización, observabilidad. |
| 9D | Monitoreo en vivo en el panel Admin. |
| 9E | Bus en vivo en la app Student (sin ETA falsa). |
| 9F | Alertas, CAN e inteligencia de flota. |

El panel administrativo no depende de Hunter: se construye en paralelo y suma el módulo "Monitoreo en vivo" cuando la ingestión sea estable.

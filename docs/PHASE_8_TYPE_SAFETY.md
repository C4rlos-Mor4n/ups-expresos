# Phase 8 — Contract and type-safety notes

Dos fallos de borde detectados durante QA nativo quedaron cubiertos:

1. La proyección Driver de `OperationalService` no seleccionaba
   `ServiceLine.description`, aunque `DriverAssignmentDto` y el contrato móvil
   lo requieren. La proyección ahora incluye el campo y la integración API
   comprueba el valor serializado.
2. El endpoint nullable `GET /driver/operational/service-runs/current` responde
   explícitamente JSON `null` cuando no existe un recorrido vigente. La
   integración API verifica tanto `Content-Type: application/json` como el
   cuerpo literal `null`; el contrato móvil acepta esa única representación y
   sigue rechazando cualquier payload no nulo malformado.

La validación de contrato no degrada a `any`: un payload operacional inválido
continúa produciendo `OperationalContractError` y una pantalla segura.

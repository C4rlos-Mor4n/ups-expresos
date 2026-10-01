# Phase 8 — Native QA evidence

Validación efectuada con el Android development client de UPS GO y el API
local contra PostgreSQL descartable el 2026-08-29.

| Flujo | Resultado |
|---|---|
| Inicio UPS GO, identidad y fondo | PASS |
| Student inicia sesión y consulta Ruta Norte | PASS |
| Student ve salida Ida 06:40 en `ASSIGNED` | PASS |
| Driver inicia sesión y ve su asignación y sus paradas | PASS |
| Driver inicia el recorrido | PASS |
| Student ve la misma salida en `IN_PROGRESS` | PASS |
| Driver reabre la app y restaura el recorrido vigente | PASS |
| Driver finaliza el recorrido | PASS |
| Student ve la misma salida en `COMPLETED` | PASS |
| SUPER_ADMIN recibe el guard de perfil no móvil | PASS |
| Reset final del dataset deja una asignación `ASSIGNED` sin recorrido | PASS |

El flujo fue deliberadamente cruzado entre sesiones Student y Driver; no es
una simulación visual aislada.

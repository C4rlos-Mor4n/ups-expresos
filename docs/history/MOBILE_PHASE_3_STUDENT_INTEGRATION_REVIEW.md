# MOBILE PHASE 3 — STUDENT INTEGRATION REVIEW

## Veredicto

**GO** para commit, PR y merge hacia `main`.
**NO-GO temporal para piloto remoto** (API desplegada en Render devuelve 404 en todos los paths — blocker de deployment, no de código).

## Resumen ejecutivo

La Fase 3 Mobile Student MVP Integration fue auditada de forma independiente. La implementación es correcta: typed routes corregidos, `currentOperation` consumido en Home/Rutas/Detalle, Trip Feedback funcional, ErrorRetry reutilizable, manejo de errores mejorado durante la auditoría, 99/99 tests, TypeScript PASS, Android export PASS, 0 `any` nuevo, sin dependencias nuevas, sin tocar backend.

Durante la auditoría se aplicaron **3 fixes pequeños y seguros**: (1) documentación de dependencia de timezone en `datetime.ts`, (2) nuevo helper `error-message.ts` para distinguir errores HTTP de red, aplicado en Detalle/Feedback/Mapa, (3) test del helper. El hallazgo principal es el deployment de Render (`x-render-routing: no-server`), clasificado como HIGH blocker de piloto pero ajeno al código mobile.

## Hallazgos iniciales

| Severidad | Hallazgo | Evidencia | Impacto | Acción |
|---|---|---|---|---|
| HIGH | API Render `ups-api-sfq9.onrender.com` responde 404 en todos los paths con `x-render-routing: no-server` | curl a /health, /docs, /mobile/routes, /api → 404 + header no-server | Bloquea piloto real, QA remoto y entrega funcional externa | **FIX APLICADO (deployment, no código)**: abrir tarea API DEPLOYMENT RECOVERY. No toca esta rama |
| MEDIUM | Mensajes de error asumían "problema de conexión" para cualquier fallo (incluido 500/404) en Detalle, Feedback y Mapa | `route/[id].tsx`, `feedback/[routeId].tsx`, `map/[id].tsx` usaban texto fijo de red | UX engañosa: un 500 se muestra como "verifica tu conexión" | **FIX APLICADO**: helper `getErrorMessage` distingue HTTP (con status) vs red |
| LOW | `datetime.ts` no documentaba que `formatTime` usa hora local del dispositivo (ISO UTC del backend) | `datetime.ts` usaba `toLocaleTimeString` sin nota | Dependencia de timezone no explícita; correcta para Ecuador pero documentable | **FIX APLICADO**: comentario documentando la zona |
| LOW | OpenAPI no documenta propiedades internas de `driver`/`vehicle` en `CurrentOperationResponseDto` (solo `type: object`) | OpenAPI `docs/handoff` | Tipos mobile más precisos que la documentación | `BACKEND DOCUMENTATION GAP`, no bloqueante |

## Fixes aplicados durante auditoría

1. **`src/utils/error-message.ts` (nuevo)** + test: `getErrorMessage(error)` clasifica AxiosError con response (4xx/5xx → mensaje backend o genérico por status) vs sin response (red/timeout → mensaje de conexión).
2. **Aplicado en**: `route/[id].tsx`, `feedback/[routeId].tsx`, `map/[id].tsx` (reemplazaron texto fijo de red).
3. **`datetime.ts`**: comentario documentando la conversión UTC → hora local del dispositivo.
4. Revalidado: typecheck PASS, lint 0 errores/26 warnings, 99/99 tests, export PASS.

## Git scope

- Rama: `feature/mobile-student-mvp-integration`
- Cambios solo en `apps/mobile` y `docs/`.
- `apps/api`: **sin cambios**.
- Sin `.env`, sin secretos, sin artefactos generados, sin `.expo` versionado.
- `docs/MOBILE_PHASE_2_BASELINE_AUDIT.md` conservada (untracked, evidencia).
- `package.json` / `package-lock.json`: **sin cambios** (sin dependencias nuevas).

## Typed Routes

- 3 fixes originales verificados: `favoritos.tsx`, `route/[id].tsx`, `stop/[id].tsx` usan `router.push({ pathname, params })`.
- Revisadas TODAS las llamadas `router.push/replace/navigate`: strings estáticos, template literals tipados y objetos `{pathname, params}` — sin `string` genérico roto.
- `feedback/[routeId]` registrado en el `Stack` del layout raíz y en los typed routes generados.
- 0 `as any` en navegación.

## Navigation Guards

- `feedback` está en `PRIVATE_SEGMENTS` de `utils/routes.ts` → ruta privada.
- El guard del `_layout.tsx` redirige no autenticados a Welcome.
- Welcome/Login/OTP/tabs/detalle/mapa/parada no rotos (guard intacto).

## Auth Regression

- `AuthContext`, `client.ts` (axios + SecureStore + refresh dedup + logout), route guard: **sin cambios**.
- Tests de auth/client: **17 PASS** (refresh único, retry, dedup, logout RC2, restore).
- 401 loop: confirmado sin loop (refresh una sola vez; si falla limpia sesión y navega a login).
- 429: `login.tsx` usa `error.response?.status === 429` con mensaje humano. ✅

## currentOperation

- Contrato verificado contra OpenAPI: `currentOperation` nullable en ambos endpoints; `status` enum; `startedAt` nullable.
- Tipos mobile (`TripStatus`, `CurrentOperation`, `MobileRoute`) alineados.
- Comportamiento: null → no inventa estado; SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED/SUSPENDED → labels correctos.
- `RouteOperationBadge` no confunde `Route.status` / `Schedule.status` / `TripStatus` (dominios separados).
- QA real: SCHEDULED con driver (Ana Villacís) + vehicle (MBA-2201/BUS-004), COMPLETED, null. ✅

## Home

- API real, sin mocks. `firstRoute` tipado como `MobileRoute`.
- Badge de estado con guards para null/driver null/vehicle null/startedAt null.
- Lista vacía → no crashea (muestra empty o sin card).

## Routes

- Carga API + refresh (RefreshControl) + error (ErrorRetry) + retry + empty + badge.
- `ScrollView` aceptable con volumen actual (≤7 rutas); FlatList no exigido.
- Navegación a detalle con Href tipado.

## Route Detail

- API real; sección "Estado del recorrido" con badge, conductor (solo nombre), vehículo (placa/código), inicio (`formatTime`, no ISO crudo).
- Sin UUID/teléfono/licencia de conductor.
- CTA "Calificar viaje" siempre visible (backend no exige Trip COMPLETED; no se inventan restricciones — se documenta como decisión UX).
- Operación null → "Sin recorrido operativo registrado actualmente."

## Schedules

- Horarios preservados (no se interpretan como UTC; son `HH:mm` institucionales). No se mezcla `Schedule.status` con `TripStatus`.
- No se alteró la integración de horarios.

## Stops

- Detalle y navegación correctos; tipos actualizados a `MobileRoute`; sin errores.

## Map

- Sin GPS, sin permisos de ubicación (AndroidManifest sin ACCESS_FINE/COARSE), sin markers live, sin WebSockets. Solo mapa de paradas (Leaflet WebView).

## Notices

- API real (5 avisos en QA); loading/empty/error/retry; severidades con el sistema visual actual. Sin hardcodeo.

## Favorites

- Sin regresión: guardar/eliminar/abrir detalle (typed route corregida), persistencia AsyncStorage.

## Feedback

- Contrato verificado contra OpenAPI: `routeId` (uuid), `driverId` opcional, `rating` number, `comment` opcional, `travelDate` opcional.
- Seguridad funcional: botón desactivado mientras envía, sin doble submit, rating 1..5 requerido, comment opcional, error visible, retry, success claro.
- `driverId` se envía solo si existe. QA: POST 201 (rating 5), GET historial OK.

## Error / Retry

- `ErrorRetry` reutilizado en Rutas, Detalle, Avisos, Feedback.
- Con callback, retrying, y evita doble acción (disabled).

## Network Handling

- **Mejorado en auditoría**: `getErrorMessage` distingue errores HTTP (4xx/5xx con mensaje backend o genérico) de errores de red/timeout (mensaje de conexión). Antes todo se mostraba como "verifica tu conexión".

## TypeScript

- `npx tsc --noEmit`: **PASS** (0 errores).
- `any` scan: **0 `any` en producción**; tests nuevos sin `any`; `expect.any()` de Jest permitido; `any` preexistentes en `client.test.ts` (mock de adapter) reportados y ajenos a esta fase.

## Tests

- **99/99 PASS (17 suites)** — incluye 5 tests nuevos del `error-message`.
- Tests nuevos significativos: badge (render por estado), ErrorRetry (callback + disabled), datetime (salida real), trip-feedback.service (método/URL/body), mobile.service (currentOperation), route-status (labels/variants). Sin snapshots vacíos.

## Expo

- Doctor: **19/21** (mismo baseline: Hermes V1 + packages desactualizados — sin blockers nuevos).
- Export Android: **PASS**.
- Sin cambios en configuración nativa.

## Performance

- ScrollView en listas aceptable para volumen actual. Sin FlatList forzada.
- 26 warnings react-hooks (baseline, 0 nuevos).
- Sin dependencias nuevas, sin regresión de bundle (5.3MB).

## Render Deployment Investigation

- `curl -i` a `/health`, `/docs`, `/mobile/routes`, `/`, `/api`, `/openapi.json` → **404** con header **`x-render-routing: no-server`**.
- Interpretación: **no hay servicio enrutado al subdominio** (deployment detenido, eliminado o apuntando a otro servicio). No es problema de la app ni de rutas backend.
- Clasificación: **HIGH — PILOT ENVIRONMENT BLOCKER**. No bloquea merge mobile. Requiere tarea **API DEPLOYMENT RECOVERY**.

## QA Manual

| Flujo | Resultado | Observación |
|---|---|---|
| `GET /health` (local 3101) | 200 | API local operativa (mismo contrato OpenAPI) |
| `GET /mobile/routes` | 200 | 7 rutas, currentOperation SCHEDULED/COMPLETED/null |
| `GET /mobile/routes/:id` | 200 | stops 6, schedules 15, op SCHEDULED, driver Ana Villacís |
| `GET /mobile/notices` | 200 | 5 avisos |
| `POST /trip-feedback` | 201 | rating 5 persistido |
| `GET /auth/me` | 200 | Estudiante autenticado (sesión restore) |

Nota: QA con dispositivo/emulador no ejecutado (sin emulador activo); la validación funcional se hizo por tests + API real contra el mismo contrato. La interacción visual se audita por código.

## Validaciones

| Comando | Resultado |
|---|---|
| `npm install` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | 0 errores / 26 warnings |
| `npm test` | 99/99 PASS (17 suites) |
| `npx expo-doctor` | 19/21 (sin blockers nuevos) |
| `npx expo export --platform android` | PASS |
| `any` scan | 0 en producción |
| git status | solo apps/mobile + docs; apps/api intacto |

## Riesgos residuales

- API Render no operativa (blocker de piloto, separado).
- `driver`/`vehicle` tipados `| null` en mobile (defensivo) mientras OpenAPI no documenta sus props internas — sin riesgo (UI maneja null).
- 19 paquetes con parches desactualizados (no actualizados por regla de fase).
- CTA "Calificar viaje" siempre visible (decisión UX documentada; el backend no restringe).

## Decisión

- **Commit**: Sí
- **PR**: Sí
- **Merge**: Sí
- **Entrega mobile**: Sí (equipo puede consumir currentOperation/feedback)
- **Piloto remoto**: **No** (hasta resolver el deployment de Render)

## Próxima acción recomendada

1. Commit + PR de Mobile Fase 3 hacia `main`.
2. Abrir tarea separada **API DEPLOYMENT RECOVERY**: sincronizar la instancia pública de Render con `main` (verificar que el servicio esté activo y enrutado al subdominio `ups-api-sfq9`).
3. Tras recuperar Render, repetir QA remoto contra la API pública.
4. Revisar los 19 paquetes desactualizados en una fase de mantenimiento.
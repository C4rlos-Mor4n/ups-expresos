# MOBILE PHASE 3 — STUDENT MVP INTEGRATION REPORT

## Veredicto

**GO** ✅ — Con evidencia verificable: typedRoutes corregido, TypeScript PASS, 94/94 tests, lint 0 errores, Expo export Android PASS, QA manual contra backend real, 0 `any` nuevo, sin tocar `apps/api`.

## Baseline

| Comando | Resultado |
|---|---|
| `npm install` | PASS |
| `npx expo-doctor` | 19/21 (2 avisos no bloqueantes: Hermes V1 + packages desactualizados) |
| `npx tsc --noEmit` | **FAIL — 3 errores typedRoutes** (esperado) |
| `npm run lint` | 0 errores / 26 warnings |
| `npm test` | 63 PASS (11 suites) |
| `npx expo export --platform android` | PASS |

## Fix typedRoutes

- **Errores iniciales**: 3 errores TS en `favoritos.tsx`, `route/[id].tsx`, `stop/[id].tsx` — `router.push("/ruta/" + id)` con concatenación de string incompatible con typed routes.
- **Solución**: se reemplazó por `router.push({ pathname: "/route/[id]", params: { id } })` (forma tipada de Expo Router). Se tipó `useLocalSearchParams<{ id: string }>()` en `route/[id].tsx`.
- **Nueva ruta `feedback/[routeId]`**: agregada al `Stack` del layout raíz y al guard privado (`utils/routes.ts`). Se regeneraron los typed routes (`.expo/types/router.d.ts`) con `expo start`.
- **Evidencia**: `npx tsc --noEmit` → **exit 0** (0 errores).

## Cambios funcionales

### Home (`(tabs)/index.tsx`)
- Tipado de `firstRoute` a `MobileRoute`.
- Badge `RouteOperationBadge` en la card del próximo horario cuando `currentOperation` existe.
- Si `currentOperation` es null, se muestra la info normal sin inventar estado.

### Routes (`(tabs)/rutas.tsx`)
- Badge operativo `RouteOperationBadge` por ruta.
- `RefreshControl` (pull-to-refresh) con `refreshRoutes`.
- Manejo de error con `ErrorRetry` cuando la carga falla.
- Empty state: "No hay rutas disponibles actualmente."
- Navegación a detalle con Href tipado.

### Route Detail (`route/[id].tsx`)
- Nueva sección **"Estado del recorrido"**: badge de estado + conductor + vehículo (placa/código) + inicio (hora amigable vía `formatTime`).
- Si no hay operación: "Sin recorrido operativo registrado actualmente."
- CTA **"Calificar viaje"** → `feedback/[routeId]` (pasa routeId y driverId si existe).
- Manejo de error con `ErrorRetry` y retry.

### currentOperation
- Tipos nuevos en `types/route.ts`: `TripStatus`, `CurrentOperation`, `CurrentOperationDriver`, `CurrentOperationVehicle`, `MobileRoute`.
- `RouteDetailResponse` y `RouteDetail` ahora incluyen `currentOperation`.
- Consumido en Home, Rutas y Detalle.

### Driver / Vehicle display
- Conductor: solo `name` (no teléfono/licencia/UUID).
- Vehículo: `plate` + `code`.
- Visible en detalle de ruta y en el badge de la lista.

### Stops / Map
- Sin cambios funcionales. El mapa (Leaflet WebView) sigue mostrando paradas sin GPS.

### Notices (`(tabs)/avisos.tsx`)
- Estado de error con `ErrorRetry`.
- Empty state mejorado: "No hay avisos publicados actualmente."

### Feedback (nuevo)
- `types/feedback.ts`: `CreateTripFeedbackInput`, `TripFeedback`, `TripFeedbackPaginatedResponse`.
- `services/trip-feedback.service.ts`: `submit` (POST /trip-feedback) y `getHistory` (GET /trip-feedback).
- Pantalla `feedback/[routeId].tsx`: selección 1–5 estrellas, comentario opcional, estados idle/submitting/success/error, evita doble submit, deshabilita botón mientras envía, pantalla de éxito con "Volver".
- CTA "Calificar viaje" en detalle de ruta.

### Favorites
- Sin cambios de lógica. Siguen locales (AsyncStorage). Verificado tras el cambio de tipos.

### Profile / Auth
- Sin cambios. Auth (OTP, SecureStore, refresh, logout con revocación) intacto.

### Error / Retry / Offline
- Componente reutilizable `ErrorRetry` (título, mensaje, botón Reintentar, retrying).
- Usado en Rutas, Detalle de ruta, Avisos y Feedback.
- Mensaje por defecto de red: "No pudimos conectarnos al servidor. Verifica tu conexión e intenta nuevamente."
- No se cambió el timeout del cliente (10s). Cold start de Render: no alterado.

### Performance
- Rutas/Avisos usan ScrollView (volumen bajo). Se agregó pull-to-refresh. No se refactorizó a FlatList porque el volumen actual (≤7 rutas) no lo justifica sin riesgo; se documenta como mejora futura.

### 401 / 429
- 401: el interceptor existente refresca y limpia sesión si el refresh falla (sin cambios; validado con tests del cliente).
- 429: `login.tsx` ya muestra "Debes esperar unos segundos antes de solicitar otro código." (sin cambios, ya existía).

## Tests

| Suite | Tests | Resultado |
|---|---|---|
| `utils/route-status.test.ts` (nuevo) | 8 | PASS |
| `components/RouteOperationBadge.test.tsx` (nuevo) | 7 | PASS |
| `components/ErrorRetry.test.tsx` (nuevo) | 5 | PASS |
| `utils/datetime.test.ts` (nuevo) | 5 | PASS |
| `services/trip-feedback.service.test.ts` (nuevo) | 3 | PASS |
| `services/mobile.service.test.ts` (extendido) | +1 (currentOperation) | PASS |
| Resto (preexistentes) | 65 | PASS |
| **Total** | **94 (16 suites)** | **PASS** |

## Expo

- Doctor: **19/21** — mismo baseline (Hermes V1 = SAFE TO DEFER, packages desactualizados = IMPORTANT, no actualizados por regla de fase).
- Export Android: **PASS** (bundle 5.3MB).
- No se actualizó SDK ni los 19 paquetes desactualizados.

## TypeScript

- `npx tsc --noEmit`: **PASS** (exit 0).
- `any` scan en `src/`: 0 `any` nuevo. Los `any` encontrados están en `client.test.ts` (mock del adapter de Axios, preexistente de la fase de estabilización) y `expect.any()` de Jest — no son código de producción.

## Archivos modificados

**Modificados (12):**
- `src/app/(tabs)/index.tsx`, `(tabs)/rutas.tsx`, `(tabs)/avisos.tsx`, `(tabs)/favoritos.tsx`
- `src/app/_layout.tsx`, `src/app/route/[id].tsx`, `src/app/stop/[id].tsx`
- `src/context/RoutesContext.tsx`
- `src/services/mobile.service.ts`, `src/services/mobile.service.test.ts`
- `src/types/route.ts`
- `src/utils/routes.ts`

**Nuevos (13):**
- `src/app/feedback/[routeId].tsx`
- `src/components/RouteOperationBadge.tsx` (+test), `ErrorRetry.tsx` (+test)
- `src/services/trip-feedback.service.ts` (+test)
- `src/types/feedback.ts`
- `src/utils/route-status.ts` (+test), `datetime.ts` (+test)
- `docs/MOBILE_PHASE_3_STUDENT_INTEGRATION_REPORT.md` (este)

**No modificados**: `apps/api/**` (regla de fase), `app.json`, `eas.json`, `tsconfig.json`, `package.json`, `.env`.

## Backend Contract Gaps

Ninguno. El contrato mobile (`/mobile/routes`, `/mobile/routes/:id`, `/mobile/notices`, `/trip-feedback`, `/auth/*`) coincide con lo que consume la app. Verificado contra OpenAPI y backend real.

## Riesgos residuales

- `currentOperation` con `driver`/`vehicle` nullable en el tipo (el OpenAPI no detalla las propiedades internas; el backend siempre los envía cuando hay operación). La UI maneja el caso null con guards.
- API desplegada `https://ups-api-sfq9.onrender.com` respondió 404 en todos los paths durante el QA (server vivo, rutas no expuestas en ese despliegue). El QA funcional se realizó contra la API local del mismo backend (mismo contrato OpenAPI). Se documenta como limitación del entorno de pruebas.
- 19 paquetes con parches más nuevos (expo-doctor IMPORTANT). No actualizados por regla.
- 26 warnings de react-hooks (preexistentes, degradados a warning). No se introdujeron nuevos.

## QA manual

Pruebas contra backend real (API local = mismo contrato OpenAPI):

| Flujo | Resultado | Observación |
|---|---|---|
| `GET /health` | 200 | API operativa |
| `GET /auth/me` | 200 | Retorna estudiante autenticado (sesión restore OK) |
| `POST /auth/request-code` | 201 | OTP enviado |
| `GET /mobile/routes` | 200 | 7 rutas, `currentOperation` SCHEDULED/COMPLETED/null |
| `GET /mobile/routes/:id` | 200 | currentOperation con driver (Ana Villacís) + vehicle (MBA-2201/BUS-004) |
| `GET /mobile/routes/:id/stops` | 200 | 6 paradas ordenadas |
| `GET /mobile/routes/:id/schedules` | 200 | 15 horarios |
| `GET /mobile/notices` | 200 | 5 avisos |
| `POST /trip-feedback` | 201 | rating 4 persistido |
| `GET /trip-feedback` | 200 | Historial con el feedback enviado |
| `/mobile/routes` sin auth | 401 | Protección correcta |

Nota: el 429 de `request-code` no se reprodujo (throttle 3/min por IP; no se alcanzó), pero el manejo UX existe en `login.tsx` y el interceptor.

## Validaciones finales

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | PASS (0 errores) |
| `npm run lint` | PASS (0 errores, 26 warnings preexistentes) |
| `npm test` | PASS — 16 suites / 94 tests |
| `npx expo-doctor` | 19/21 (sin blockers nuevos) |
| `npx expo export --platform android` | PASS |
| `any` scan | 0 `any` nuevo |
| git status | Solo `apps/mobile` + `docs/`, sin secretos, sin `.env`, sin artefactos |

## Próxima fase recomendada

- Evaluar TanStack Query para server-state si el volumen de consultas crece (documentado; no introducido por regla).
- Migrar listas de Rutas/Avisos a `FlatList` cuando el volumen lo justifique.
- Revisar los 19 paquetes desactualizados (expo install --check) en una fase dedicada de actualización.
- Una vez el despliegue de Render exponga los endpoints, repetir QA contra esa instancia.
- Fase DRIVER (flujo conductor) cuando el producto lo requiera, manteniendo una sola app.
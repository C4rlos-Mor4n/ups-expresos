# UPS EXPRESOS MOBILE — PHASE 3 FUNCTIONAL STABILIZATION

## 1. Executive Summary

```text
Status:                      PASS
Functional regressions:      0
Ready for merge:             GO
Ready for Phase 4:           GO
```

## 2. Baseline

```text
Baseline SHA:
15d4da039eb2822352acd833d3f7c82c943f4030

Branch:
fix/mobile-functional-stabilization-phase-3

Final SHA:
662894fbc0c9e76412c6a1df9fd47a2c220ae76e

Commits:
b7fa8ca fix(mobile): align route detail with backend contract
99e5686 refactor(mobile): consolidate HTTP client
2301b21 fix(mobile): revoke backend session on logout and harden session restoration
c0ae87e fix(mobile): protect authenticated routes consistently
c0fefe9 fix(mobile): calculate the actual next schedule
f81d1aa fix(mobile): support paginated routes and notices
abddf33 fix(mobile): remove unsafe API fallback and sensitive logging
606ff63 security(mobile): harden Leaflet WebView payload handling
93a6af4 refactor(mobile): eliminate remaining any casts and tighten types
662894f test(mobile): expand functional stabilization coverage
e048796 docs(mobile): add phase 3 functional stabilization report
```

(11 commits en total desde el baseline `15d4da0` hasta el head.)

## 3. Findings Addressed

| ID | Finding           | Status                          |
| -- | ----------------- | ------------------------------- |
| H1 | Route contract    | FIXED                           |
| H2 | Logout            | FIXED                           |
| H4 | Protected routes  | FIXED                           |
| M2 | Dual HTTP client  | FIXED                           |
| M3 | Sensitive logging | FIXED                           |
| M4 | Ngrok fallback    | FIXED                           |
| M5 | N+1               | BACKEND REQUIRED (documented)   |
| M7 | Pagination        | FIXED                           |
| M8 | Next schedule     | FIXED                           |

## 4. API Contract

```text
Route detail (GET /mobile/routes/:id):
MATCH — response tipado como { route, stops, schedules } (RouteDetailResponse).

Route stops:
MATCH — RouteStop { id, stopOrder, estimatedArrivalMinutes?, notes?, stop }.

Schedules:
MATCH — Schedule { id, routeId, dayOfWeek, direction, departureTime,
approximateArrivalTime?, status }.

Notices:
MATCH — PaginatedResponse<Notice> { data, meta }.
```

- `RouteStop.stopId` (inexistente en backend) eliminado del tipado.
- `description` alineado a `string | null`.
- `approximateArrivalTime` / `estimatedArrivalMinutes` / `notes` con optionality
  correcta.
- Campos no devueltos por el endpoint mobile (`isActive`, `createdAt`,
  `updatedAt` en Notice) corregidos.

## 5. HTTP Layer

```text
HTTP clients before:
2  (src/api/client.ts + src/services/api.ts)

HTTP clients after:
1  (src/api/client.ts)

Bearer:
PASS

Refresh:
PASS

401 retry:
PASS

Infinite loop protection:
PASS  (_retry flag + exclusión de /auth/*)

Refresh concurrency:
PASS  (refreshPromise único en vuelo, compartido entre 401 simultáneos)
```

## 6. Authentication

Flujo final:

```text
startup:
  SecureStore → tokens? → NO → unauthenticated
                        → SÍ → restore optimista → getMe() valida
                              → access válido → authenticated
                              → access expirado → refresh automático
                              → refresh falla → onSessionExpired limpia

login:
  request-code → verify-code → tokens persistidos en SecureStore

OTP:
  verify-code → login(accessToken, refreshToken, user)

logout:
  POST /auth/logout con Bearer + refreshToken body → revoca sesión
  → limpieza local SIEMPRE (incluso si backend no disponible)
  → estado React → navegación pública
```

## 7. Session Lifecycle

```text
LOGIN → session creada (SecureStore)
  → APP KILL / RESTART → loadSession restaura de forma optimista
  → ACCESS EXPIRES → cliente HTTP refresca (único en vuelo)
  → REFRESH OK → nuevos tokens persistidos → sesión continúa
  → REFRESH FAIL → tokens eliminados → onSessionExpired → público
  → LOGOUT → backend revocado → SecureStore limpio → público
```

## 8. Navigation

```text
Public routes:
  /            (redirige según sesión)
  (auth)/login
  (auth)/otp

Private routes:
  (tabs)/*
  route/[id]
  map/[id]
  stop/[id]

Unauthenticated private access:
  REDIRECTED al flujo público (guard a nivel de rutas).
```

## 9. Business Logic

Solución `getNextSchedule` (función pura en `utils/schedule.ts`):

- Calcula el siguiente horario real según día local y hora local.
- Considera transición fin de día → siguiente día y domingo → lunes.
- Casos probados: horario posterior hoy, todos pasados → mañana, salto
  domingo→lunes, lista vacía, un solo horario, horarios fuera de orden.
- Decisión de timezone: se usa la hora local del dispositivo (comportamiento
  existente/esperado); no se introdujo conversión UTC innecesaria.

## 10. Pagination

```text
routes:
  RoutesContext pagina con page/limit (20), appendPage deduplica por id,
  hasMore de meta.totalPages. UI: botón "Cargar más rutas".
  refresh → reset a página 1.

notices:
  AvisosScreen pagina con page/limit (20), appendPage deduplica por id.
  UI: botón "Cargar más avisos".

last page:
  hasMore = page < totalPages → oculta el botón al llegar a la última.

dedupe:
  appendPage deduplica por id (Map) al fusionar páginas.
```

## 11. N+1

```text
Resolved:
NO

Backend change required:
YES

Reason:
No existe endpoint para obtener "rutas que pasan por una parada". Los únicos
endpoints mobile son routes, routes/:id, routes/:id/stops, routes/:id/schedules
y notices. Para listar las rutas de una parada, el cliente debe consultar las
stops de cada ruta (O(n) requests) — N+1 estructural. La información no está
cargada en cliente (RoutesContext solo tiene resúmenes sin stops).

Propuesta de contrato (NO implementada en esta fase):
GET /mobile/stops/:id/routes → Route[]  (rutas activas que contienen la parada)
o incluir la relación en una response existente.

El N+1 se documenta formalmente; no se modificó backend ni se ocultó el
problema con caché.
```

## 12. Security

```text
Sensitive logs:
REMOVED  (se eliminó logging de params/response; catch de auth sin `error: any`)

Hardcoded API fallback:
REMOVED  (client.ts falla claro si falta EXPO_PUBLIC_API_URL)

Tokens in SecureStore:
PRESERVED  (expo-secure-store; NO AsyncStorage)

WebView hardening:
DONE  (escape de JSON en <script> vía escapeScriptJson; mixedContentMode="never"
       dado que todos los recursos son https)
```

## 13. Type Safety

```text
Before:
any      = 7
as any   = 5
ts-ignore = 0

After:
any      = 0
as any   = 0
ts-ignore = 0

(Non-test source. ts-ignore/ts-expect-error = 0 antes y después.)
```

## 14. Lint

```text
Errors:
0

Warnings before:
31

Warnings after:
26

Warnings fixed because touched code:
5

Warnings intentionally preserved:
Restantes (set-state-in-effect en patrón de restauración de sesión, BOM
preexistente en stop/[id].tsx, deps de hooks) — refactor no relacionado.
```

Nota: los warnings no son bugs; se corrigieron los del código tocado cuando
fue seguro y coherente.

## 15. Tests

```text
Suites:  11
Tests:   62
Passed:  62
Failed:  0
```

Por categoría:

```text
contract        → mobile.service.test.ts, auth.service.test.ts
HTTP            → client.test.ts (baseURL, Bearer, 401 refresh, concurrency,
                  network error, fail-fast config, token rotation notify)
auth/session    → auth.service.test.ts (request/verify/logout body/me)
refresh         → client.test.ts (401 retry, refresh failure limpia sesión,
                  concurrency, notify rotation)
logout          → auth.service.test.ts + client.test.ts + AuthContext.test.tsx
                  (Bearer + body; usa el refresh token vigente de SecureStore)
navigation      → utils/routes.test.ts (rutas privadas/públicas)
business logic  → utils/schedule.test.ts (próximo horario)
pagination      → utils/pagination.test.ts + mobile.service.test.ts
security        → utils/scriptJson.test.ts + utils/htmlEscape.test.ts
                  (escapado WebView + escapado HTML contextual)
```

## 16. RC1 — Correcciones de review técnico

Tres correcciones solicitadas en el review externo antes del merge, sin tocar
backend, contratos, DB ni UI:

### 16.1 HIGH — refresh → logout tras rotación de tokens

El cliente HTTP rota access y refresh token en un 401 y los persiste en
SecureStore, pero el estado React de `AuthContext` quedaba stale. El backend
revoca la sesión antigua durante refresh y crea una nueva, por lo que un logout
posterior podía enviar el refresh token anterior y dejar la sesión nueva activa.

Corrección:

```text
- logout() lee SIEMPRE el refresh token vigente de SecureStore (fuente de
  verdad) en lugar de confiar en el estado React potencialmente stale.
- Se añadió setOnTokensRotated: el cliente HTTP notifica a AuthContext cuando
  el refresh rota los tokens, de modo que accessToken/refreshToken expuestos
  por useAuth reflejan los valores vigentes de SecureStore.
- Test obligatorio añadido: login R1 → refresh produce R2 → logout usa R2
  (no R1). Cobertura: AuthContext.test.tsx + client.test.ts (notify rotation).
```

### 16.2 MEDIUM — API URL fail-fast

Antes, `EXPO_PUBLIC_API_URL` ausente solo producía un `console.warn` en dev; en
prod no avisaba y Axios se creaba igual con `baseURL` undefined (en web podía
caer en un origin relativo ambiguo).

Corrección:

```text
- validateApiUrl() lanza un error explícito en cualquier entorno (dev y prod)
  si la URL falta, está vacía o no es http(s) absoluta. Sin fallback.
- Tests añadidos para URL válida / ausente / vacía / relativa / protocolo no
  http(s).
```

### 16.3 MEDIUM — Escapado HTML contextual en Leaflet

`escapeScriptJson()` evita cerrar el bloque `<script>`, pero los valores
(`stop.name`, `stop.reference`, `stop.order`) se concatenaban después en HTML
para `L.divIcon` y `bindPopup`, permitiendo inyección de HTML (p. ej.
`<img onerror=...>`).

Corrección:

```text
- Se añadió escapeHtml() (utils/htmlEscape.ts) y su variante JavaScript
  (ESCAPE_HTML_JS) inyectada en el WebView, aplicada a order/name/reference
  antes de construir iconHtml y popup.
- Tests para < > & " ' y payloads maliciosos (<img>, <script>, </script>).
```

### 16.4 — Conteo de commits

Reporte alineado con Git: 11 commits desde el baseline `15d4da0` hasta el head.

### 16.5 — Veredicto

```text
Fase 3 funcional:          PASS CON CORRECCIONES
Backend / contratos / DB:  NO TOCADOS
Resultado requerido:       MERGE GO RC1 (tras validación automatizada)
```

## 17. Automated Validation

| Gate        | Result                       |
| ----------- | ---------------------------- |
| npm ci      | PASS                         |
| Typecheck   | PASS                         |
| Lint        | PASS (0 errors, 26 warnings) |
| Tests       | PASS (62/62)                 |
| Expo config | PASS                         |
| Expo Doctor | WARN (2 preexisting: Hermes V1 memory regression + package patch versions) |
| Expo export | PASS                         |

## 18. Android QA

```text
Runtime QA:
BLOCKED_BY_ENVIRONMENT

Environment:
unavailable (sin Android SDK, adb, emulator ni AVDs)

Verificaciones realizadas:
  Expo config       PASS
  Expo export       PASS (Metro bundle generado, todas las rutas)
  tests             PASS
  typecheck         PASS
  lint              PASS

Flujos QA previstos (no ejecutables por entorno):
  app start sin sesión / login / OTP / session restore / home / routes /
  route detail / map / stop detail / notices / favorites / profile /
  expired access / refresh / logout / restart post-logout / deep links.
```

## 19. Backend Impact

```text
apps/api modified:
NO

Backend contract changed:
NO

Database changed:
NO
```

## 20. Security Repository Gate

```text
.env tracked:
NO

Secrets:
NO

Keys:
NO

Credentials:
NO
```

`.env.example` creado en `apps/mobile/.env.example` con placeholder seguro.

## 21. Deferred Work

```text
Phase 4 (controlada):
  Expo/RN patch stabilization
  Hermes V1 memory regression
  Dependency updates (expo install --check)

Future performance:
  FlatList virtualization en listas largas
  Otras optimizaciones de render

Future UI:
  Design system
  Visual redesign (fuera de alcance de Fase 3)

M5 backend (fuera de fase):
  GET /mobile/stops/:id/routes (o equivalente) para eliminar el N+1
```

## 22. Regression Comparison

Contra `15d4da039eb2822352acd833d3f7c82c943f4030`:

```text
New functional regressions:
0

New type errors:
0

New lint errors:
0

New Expo Doctor issues:
0  (los 2 fallos de doctor son los PREEXISTENTES de la Fase 2)
```

## 23. MERGE GO / NO-GO

```text
MERGE GO RC1  (tras correcciones de review técnico; ver §16)
```

Criterios P0 cumplidos:

```text
H1 contract                 FIXED
H2 logout                   FIXED (incl. rotación de refresh token, §16.1)
M2 HTTP client              FIXED
session lifecycle           FIXED (estado React sincronizado tras rotación)
H4 guard                    FIXED
M8 next schedule            FIXED
M3 logging                  FIXED
M4 API fallback             FIXED (fail-fast en dev y prod, §16.2)
WebView HTML injection      FIXED (§16.3)

npm ci                      PASS
typecheck                   PASS
lint                        PASS — 0 errors
tests                       PASS (62/62)
expo config                 PASS
expo export                 PASS

new regressions             0
new TS escapes              0
backend breaking changes    0
secrets                     0
```

M5 queda como `BACKEND CHANGE REQUIRED` con evidencia documentada (no existe
endpoint para rutas de una parada).

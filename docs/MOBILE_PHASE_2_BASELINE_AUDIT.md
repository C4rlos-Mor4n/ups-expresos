# MOBILE PHASE 2 — BASELINE & API INTEGRATION AUDIT

## 1. Veredicto

**GO** para iniciar Fase 3 (con 3 fixes menores de typecheck como prerequisito).

La app mobile es una base funcional sólida: Expo Router, auth real con SecureStore + refresh rotativo, servicios API reales para rutas/horarios/paradas/avisos, contexto de estado con caché, y tests que pasan. El único bloqueo real para arrancar Fase 3 es que `npx tsc --noEmit` falla con **3 errores de `typedRoutes`** (concatenación de strings en `router.push`). No hay mocks hardcodeados; todo viene de API real.

## 2. Resumen ejecutivo

- **Arquitectura**: Expo SDK 57 + Expo Router (file-based routing) + Context API + hooks + axios + SecureStore + AsyncStorage. Sin Redux/Zustand/TanStack Query.
- **Auth**: funcional y robusta. OTP real, tokens en SecureStore, refresh automático con deduplicación de requests concurrentes, logout con revocación.
- **API**: cliente único axios con fail-fast config, interceptor de Bearer, manejo de 401 con refresh y retry.
- **Datos**: NO hay mocks. Todas las pantallas consumen `mobileService`/`authService` reales.
- **Gap principal Fase 3**: `currentOperation` existe en el backend pero NO está tipado ni consumido en la app. No hay Trip Feedback. Favoritos son 100% locales.
- **Baseline**: tests 63/63 PASS, lint 0 errores, expo export PASS, expo-doctor 19/21 (2 avisos no bloqueantes), typecheck **FAIL** (3 errores de typed routes).

## 3. Arquitectura actual

```
apps/mobile (Expo SDK 57, React Native 0.86, Expo Router, npm)
├── src/
│   ├── app/                    # Expo Router (file-based routing)
│   │   ├── _layout.tsx         # Stack raíz + AuthProvider + guard de rutas
│   │   ├── index.tsx           # Welcome (pantalla inicial)
│   │   ├── (auth)/             # Grupo auth: login, otp
│   │   ├── (tabs)/             # Grupo tabs: Inicio, Rutas, Avisos, Favoritos, Perfil
│   │   ├── route/[id].tsx      # Detalle de ruta
│   │   ├── map/[id].tsx        # Mapa de ruta (Leaflet WebView)
│   │   └── stop/[id].tsx       # Detalle de parada
│   ├── api/client.ts           # Cliente axios único + refresh + SecureStore
│   ├── components/LeafletMap.tsx  # Mapa Leaflet en WebView (sin GPS)
│   ├── constants/Colors.ts     # Paleta UPS (azul 00205B / amarillo F2A900)
│   ├── context/                # AuthContext, RoutesContext, FavoritesContext, FavoriteStopsContext, ThemeContext
│   ├── services/               # auth.service, mobile.service
│   ├── types/                  # api, auth, route, stop, notice
│   └── utils/                  # schedule, routes, pagination, htmlEscape, scriptJson
├── app.json                    # ids, plugins, scheme, splash
├── eas.json                    # preview (apk) + production (app-bundle)
├── jest.setup.js               # define EXPO_PUBLIC_API_URL para tests
└── tsconfig.json               # strict: true, paths @/*
```

- **Gestor**: npm (no pnpm). No hay `package.json` raíz ni monorepo pnpm en el repo.
- **Nativa**: `android/` generado por prebuild (gitignored). Dev build con `expo-dev-client`.

## 4. Dependencias

Clasificación de `npm ls --depth=0` (package.json):

### Core
- `expo ~57.0.2`, `react 19.2.3`, `react-dom 19.2.3`, `react-native 0.86.0` — estándar, sin riesgo.

### Navegación
- `expo-router ~57.0.3` — file-based routing (usa React Navigation por debajo). `@react-navigation/native ^7.3.7` como dependencia transitiva directa. **Correcto y en uso.**

### Networking
- `axios ^1.18.1` — cliente único con interceptores. **En uso, correcto.**
- No hay TanStack Query / SWR / ky.

### Estado
- Context API (React) — `AuthContext`, `RoutesContext`, `FavoritesContext`, `FavoriteStopsContext`, `ThemeContext`. **Sin librería externa.**
- No hay Zustand / Redux / Jotai / MobX.

### Persistencia
- `@react-native-async-storage/async-storage 2.2.0` — favoritos + caché de rutas.
- `expo-secure-store ~57.0.0` — tokens (access/refresh) + user. **Uso correcto: tokens en almacén seguro.**

### UI
- `@expo/vector-icons`, `lucide-react-native`, `react-native-svg`, `@expo/ui ~57.0.3`, `@expo-google-fonts/inter`. Sin NativeWind/Tamagui/Paper.

### Mapas
- `react-native-webview 13.16.1` — mapa **Leaflet** en WebView (no react-native-maps). No usa GPS.

### Desarrollo
- `expo-dev-client ~57.0.15` (instalado), `jest-expo`, `eslint`, `typescript ~6.0.3`. Scripts: `start`, `android`, `ios`, `web`, `lint` (= `expo lint`), `test` (= `jest`). **No hay scripts `typecheck` ni `build`/`export` definidos.**

**Observaciones**: ninguna dependencia parece abandonada o duplicada. `@expo/ui` y `expo-glass-effect`/`expo-symbols` están en deps pero su uso real es limitado/no crítico (revisar en Fase 3 si se usan). `react-native-worklets` es requerido por reanimated.

## 5. Navegación

Árbol real (Expo Router):

```
Root (Stack, headerShown:false) — src/app/_layout.tsx
├── index                    # Welcome: si autenticado → replace /(tabs); si no → botón login
├── (auth)/_layout (Stack)
│   ├── login                # request-code → push /(auth)/otp
│   └── otp                  # verify-code → login() → replace /(tabs)
└── (tabs)/_layout (Tabs, 5 pestañas)
    ├── index                # Inicio (Home)
    ├── rutas                # Lista de rutas
    ├── avisos               # Avisos
    ├── favoritos            # Favoritos (rutas + paradas locales)
    └── perfil               # Perfil + logout
    └── (stack privado, fuera de tabs, accesible por push)
        ├── route/[id]       # Detalle de ruta
        ├── map/[id]         # Mapa de la ruta
        └── stop/[id]        # Detalle de parada
```

- **Pantalla inicial**: `index` (Welcome).
- **Guard**: `_layout.tsx` raíz usa `useSegments` + `isPrivateRoute` (utils/routes.ts). Si no autenticado y navega a segmento privado (`tabs`, `route`, `map`, `stop`) → `router.dismissAll()` o `replace("/")`.
- **Redirects**: Welcome redirige a `(tabs)` si autenticado. AuthContext restaura sesión (optimista + valida con `/auth/me`).
- **Deep links**: scheme `upsexpresosmobile` en app.json; expo-router genera `_sitemap`. No hay deep links custom explícitos.
- **typedRoutes**: activado (`experiments.typedRoutes: true`). Esto causa los **3 errores de typecheck** (ver §25 y riesgos).

**Bugs de navegación detectados**:
1. `router.push("/route/" + route.id)` etc. rompen los tipos de `typedRoutes` (3 errores tsc).
2. La ruta `stop/[id]` se navega con params (`routeId`, `stopOrder`, etc.) vía `useLocalSearchParams` — funciona, pero el tipo `[id]` no valida los params extra (riesgo bajo).

## 6. Inventario de pantallas

| Pantalla | Archivo | Accesible | Propósito | Fuente de datos | API real | Mock | Hardcode | Estado | Reutilizable | Acción futura |
|---|---|---|---|---|---|---|---|---|---|---|
| Welcome | `src/app/index.tsx` | Sí | Landing + login | — | No | No | No | FUNCTIONAL | Sí | Conservar |
| Login | `(auth)/login.tsx` | Sí | request-code OTP | `authService.requestCode` | Sí | No | No | FUNCTIONAL | Sí | Conservar |
| OTP | `(auth)/otp.tsx` | Sí | verify-code + login | `authService.verifyCode` | Sí | No | No | FUNCTIONAL | Sí | Conservar |
| Home | `(tabs)/index.tsx` | Sí | Resumen rutas + próximo horario | `RoutesContext` + `mobileService.getRouteSchedules` | Sí | No | No | FUNCTIONAL | Sí | Agregar `currentOperation` |
| Rutas | `(tabs)/rutas.tsx` | Sí | Lista de rutas | `RoutesContext` | Sí | No | No | FUNCTIONAL | Sí | Agregar badge `currentOperation` |
| Avisos | `(tabs)/avisos.tsx` | Sí | Lista de avisos | `mobileService.getNotices` | Sí | No | No | FUNCTIONAL | Sí | Conservar |
| Favoritos | `(tabs)/favoritos.tsx` | Sí | Favoritos rutas + paradas | `FavoritesContext` + `FavoriteStopsContext` (AsyncStorage) | No (local) | No | No | FUNCTIONAL | Sí | Conservar (local) |
| Perfil | `(tabs)/perfil.tsx` | Sí | Usuario + logout | `AuthContext` | Sí | No | No | FUNCTIONAL | Sí | Conservar; roleMap ya incluye DRIVER |
| Detalle ruta | `route/[id].tsx` | Sí | Info ruta + horarios + paradas | `mobileService.getRouteDetail` | Sí | No | No | FUNCTIONAL | Sí | Agregar `currentOperation` + conductor/vehículo |
| Mapa | `map/[id].tsx` | Sí | Mapa Leaflet de paradas | `mobileService.getRouteDetail` | Sí | No | No | FUNCTIONAL | Sí | Conservar (sin GPS) |
| Parada | `stop/[id].tsx` | Sí | Detalle parada + rutas que la usan | `RoutesContext` (filtra por stops) | Sí | No | No | FUNCTIONAL | Sí | Conservar |

## 7. Autenticación actual

Flujo completo funcional:
1. **Login**: ingresa email → `authService.requestCode(email)` → navega a OTP.
2. **Dominio**: el backend valida dominio (`ALLOWED_EMAIL_DOMAINS`); la app no valida en cliente (correcto: el backend es la fuente).
3. **OTP**: `authService.verifyCode(email, code)` → obtiene `{ accessToken, refreshToken, user }`.
4. **Sesión**: `AuthContext.login()` guarda en **SecureStore** (access_token, refresh_token, user) y actualiza estado React.
5. **Persistencia**: `loadSession()` restaura optimista desde SecureStore y valida con `GET /auth/me` (el refresh automático rota si expiró).
6. **Refresh automático**: en `api/client.ts` — interceptor de respuesta: 401 → refresh (único en vuelo, deduplicado) → retry; si refresh falla → limpia sesión y notifica `onSessionExpired`.
7. **Logout**: `AuthContext.logout()` → lee refresh token vigente de SecureStore → `authService.logout(refreshToken)` → limpia SecureStore + estado. Con manejo RC2 (retry con tokens rotados si el access expiró).
8. **Sesión expirada**: al fallar refresh se limpia y el guard navega a Welcome.

**Riesgo**: ninguno crítico. Tokens en SecureStore (no AsyncStorage). No hay usuario/token mock. No hay auth visual-only: todo valida contra backend.

## 8. API actual

- **Cliente**: `src/api/client.ts` — `axios.create({ baseURL: API_URL, timeout: 10000 })`.
- **baseURL**: `validateApiUrl(process.env.EXPO_PUBLIC_API_URL)` — fail-fast: lanza si falta o no es http(s). No hardcodea.
- **Authorization**: interceptor de request lee `SecureStore` y añade `Bearer`.
- **401**: interceptor de response hace refresh único en vuelo (`refreshPromise`), rota tokens en SecureStore, notifica `setOnTokensRotated`, y re-intenta. Logout con 401 usa el refresh rotado (RC2).
- **Network errors / timeout**: `timeout: 10000`; errores sin response se rechazan (el interceptor no los trata como 401). Manejo en cada pantalla con catch.
- **Servicios**: `authService` (request-code, verify-code, refresh, logout, me) y `mobileService` (routes, route/:id, stops, schedules, notices).

## 9. Estado y persistencia

| Estado | Mecanismo | Persistencia |
|---|---|---|
| Sesión (tokens + user) | `AuthContext` | SecureStore |
| Rutas (lista + paginación) | `RoutesContext` | AsyncStorage caché `@ups_routes_cache` |
| Favoritos rutas | `FavoritesContext` | AsyncStorage `favorite_routes` |
| Favoritos paradas | `FavoriteStopsContext` | AsyncStorage `favorite_stops` |
| Tema | `ThemeContext` | Solo estático (Colors) |
| Horarios/avisos/paradas | useState local en pantallas | Sin persistencia |

**Gap**: no hay estado de server-state gestionado (TanStack Query no está). `RoutesContext` ya implementa caché + paginación + revalidación manual — es un patrón previo a TanStack Query. Para Fase 3 se recomienda evaluar TanStack Query sin romper la arquitectura actual (o mantener el patrón de contextos si el volumen no lo exige).

## 10. Rutas

- **Lista** (`rutas.tsx`): usa `useRoutes()` → `mobileService.getRoutes({page, limit})` (API real `GET /mobile/routes`). Caché + load more.
- **Detalle** (`route/[id].tsx`): `mobileService.getRouteDetail(id)` → `GET /mobile/routes/:id`. Muestra nombre, dirección, horarios agrupados por dirección, paradas.
- **Home**: muestra primera ruta + `getNextSchedule` (utilidad local).
- **Tipo `Route`** (`types/route.ts`): alineado con el backend (`id, name, description, direction, status, isActive, createdAt, updatedAt`).
- **Gap**: los tipos NO incluyen `currentOperation` (el backend ya lo devuelve). Ver §16.

**Conectable directamente**: lista y detalle. **Requiere adaptación**: agregar `currentOperation` a tipos y UI.

## 11. Horarios

- **Fuente**: `mobileService.getRouteSchedules(id)` → `GET /mobile/routes/:id/schedules` (API real).
- **Utilidad**: `utils/schedule.ts` `getNextSchedule(schedules, now)` — calcula el próximo horario considerando día de semana y hora local; avanza a la siguiente ocurrencia. Correcto.
- **Display** (`route/[id].tsx`): agrupa por dirección (IDA/RETORNO), muestra rango de días (ej. "Lun - Vie") y las primeras 5 horas, calcula frecuencia aproximada.
- **Timezone**: usa hora local del dispositivo. El backend manda `departureTime` como string "HH:MM". Sin riesgo mayor para MVP.

**Gap**: no hay distinción visual ida/retorno con etiqueta explícita más allá del `direction` (el backend usa "IDA"/"RETORNO"). No hay próximos horarios en la lista de rutas (solo en Home). Aceptable.

## 12. Paradas y mapa

- **Fuente**: `mobileService.getRouteStops(id)` → `GET /mobile/routes/:id/stops` (API real).
- **Orden**: el backend manda `stopOrder`; la app lo usa para numerar (LeafletMap muestra orden en el marcador).
- **Coordenadas**: `latitude`/`longitude` (Decimal → number). La app las renderiza.
- **Soporte** de `estimatedArrivalMinutes` y `notes`: tipados en `RouteStop`; el detalle de ruta y mapa las consumen (parcial — `estimatedArrivalMinutes` se muestra en stop/[id]).
- **Mapa**: `LeafletMap` (WebView + Leaflet 1.9.4 + tiles CARTO + routing OSRM). **No usa GPS** — solo renderiza las paradas de la ruta. Sin permisos de ubicación.

**Gap Fase 3**: para el MVP basta mostrar paradas en mapa (ya funciona). No se necesita GPS/background location. El routing OSRM (línea por calles) es un plus externo que depende de red.

## 13. Avisos

- **Fuente**: `mobileService.getNotices({page, limit})` → `GET /mobile/notices` (API real).
- **Pantalla** `avisos.tsx`: paginación (load more), severidad (`INFO/WARNING/CRITICAL`) con mapa de colores, estado vacío.
- **Estados**: loading ✅, error ✅ (log + set vacío), empty ✅, retry ❌ (no hay botón de reintento explícito).
- **Fechas**: muestra `publishedFrom`/`publishedUntil` — la app no filtra expiración en cliente (el backend ya filtra activos). Correcto.

## 14. Feedback

- **No existe** ninguna funcionalidad de Trip Feedback en la app (sin pantalla, sin servicio, sin tipos).
- Backend expone `POST /trip-feedback`, `GET /trip-feedback`, `GET /trip-feedback/:id`.

**Gap Fase 3**: implementar pantalla de calificar viaje (estrellas + comentario) + historial. Es 100% nuevo.

## 15. Perfil

- **Fuente**: `AuthContext` (`user` de `/auth/me`).
- Muestra nombre (o derivado del email), email, rol (roleMap con STUDENT/ADMIN/SUPER_ADMIN/**DRIVER**).
- Botón **logout** funcional (revoca + limpia).

**Listo** para Fase 3. El roleMap ya contempla DRIVER para la evolución futura.

## 16. currentOperation

- **En la app**: NO existe ningún concepto equivalente (no hay bus activo, ruta iniciada, conductor/vehículo, estado de recorrido). Verificado: sin referencias a `currentOperation`, `IN_PROGRESS`, `TripStatus`, etc.
- **En el backend**: `GET /mobile/routes` y `GET /mobile/routes/:id` devuelven `currentOperation` (nullable) con `{ status, driver {id,name}, vehicle {id,plate,code}, startedAt, tripId }`.
- **Estados backend**: `SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED | SUSPENDED`.

**Mapeo propuesto Fase 3**:
```ts
currentOperation: {
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'SUSPENDED';
  driver: { id: string; name: string };
  vehicle: { id: string; plate: string; code: string };
  startedAt: string | null;
  tripId?: string;
} | null
```

Etiquetas sugeridas (UI futura):
- `SCHEDULED` → "Programado"
- `IN_PROGRESS` → "En recorrido"
- `COMPLETED` → "Recorrido finalizado"
- `CANCELLED` → "Cancelado"
- `SUSPENDED` → "Suspendido"

**Gap de integración**: agregar el tipo, consumirlo en Home/Rutas/Detalle, y mostrar conductor/vehículo/estado.

## 17. Roles y preparación DRIVER

- La app es **una sola app** (sin separación conductor/estudiante).
- `AuthUser.role` tipa los 4 roles; `perfil.tsx` los muestra todos.
- La navegación actual NO bifurca por rol. El guard solo distingue autenticado/no.
- Backend soporta `GET /auth/me` → role; y flujo conductor (`/driver/...`) ya implementado.

**Evolución sin reescritura**: el layout raíz podría añadir un `if (user.role === 'DRIVER')` para renderizar un stack conductor distinto, manteniendo el stack estudiante. La arquitectura Expo Router lo permite con un grupo adicional `(driver)`. No se implementa en Fase 3 (solo STUDENT).

## 18. Hardcodes y mocks

| Archivo | Contenido | Riesgo | Solución futura |
|---|---|---|---|
| `src/components/LeafletMap.tsx` | URLs de CDN Leaflet/CARTO/OSRM (públicas, no secretos) | Bajo (depende de terceros) | Mantener; evaluar tiles propios si se requiere offline |
| `src/app/(tabs)/index.tsx` | Muestra `routes[0]` como "primera ruta" del Home | Bajo (depende del orden de la API) | Elegir ruta destacada por `currentOperation` en Fase 3 |
| `jest.setup.js` | `EXPO_PUBLIC_API_URL=https://api.example.com` (solo tests) | Nulo | Mantener |
| `src/types/*` | Tipos de contratos API (no datos mock) | Nulo | Mantener, extender con `currentOperation` |
| `utils/route.ts` DAY_ORDER/DAY_SHORT | Constantes de presentación | Nulo | Mantener |

**No hay arrays de rutas/paradas/horarios hardcodeados, ni usuarios/tokens mock.**

## 19. Seguridad

- **Tokens**: access + refresh en **SecureStore** (seguro). ✅
- **AsyncStorage**: solo favoritos y caché de rutas (no sensibles). ✅
- **console.\***: 14 usos, todos de manejo de errores de red/API o del WebView. Ninguno expone tokens/datos personales. ✅
- **Secrets**: sin passwords/apiKeys/URLs secretas en el código. Solo `EXPO_PUBLIC_API_URL` (pública, no secreta). ✅
- **`.env`**: `.gitignore` ignora `.env` (excepto `.env.example`). El `.env` local no está trackeado. ✅
- **Logout**: revoca la sesión backend antes de limpiar local. ✅
- **WebView**: `mixedContentMode="never"` (solo https), escapado HTML/JS de datos inyectados (`htmlEscape`, `escapeScriptJson`). ✅

## 20. Performance

- **ScrollView vs FlatList**: 7 pantallas usan `ScrollView`; **ninguna usa `FlatList`**. Para listas cortas (rutas ~7, avisos) es aceptable, pero para crecimiento es subóptimo. Riesgo MEDIUM-LOW.
- **Renders**: `ThemeContext` y contexts usan `useMemo`/`useCallback` correctamente. `RoutesContext` evita re-fetches innecesarios (guarda por `isAuthenticated`).
- **Consultas repetidas**: Home consulta schedules de la primera ruta en cada mount; no hay cache de schedules. Riesgo LOW.
- **useEffect con setState síncrono**: 26 warnings de lint (reglas react-hooks degradadas a warning). Riesgo LOW (diferido a Fase 3).
- **Imágenes**: assets locales; sin pesos críticos.

## 21. UX states

| Pantalla | loading | error | empty | retry | offline |
|---|---|---|---|---|---|
| Welcome | ✅ | — | — | — | — |
| Login | ✅ | ✅ | — | — | — |
| OTP | ✅ | ✅ (shake) | — | — | — |
| Home | ✅ | ✅ (log) | ✅ | ❌ | ❌ |
| Rutas | ✅ | ❌ (solo log) | ✅ | ❌ | ❌ |
| Avisos | ✅ | ✅ | ✅ | ❌ | ❌ |
| Favoritos | ❌ (local instantáneo) | ❌ | ✅ | ❌ | — |
| Perfil | — | — | — | — | — |
| Detalle ruta | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mapa | ✅ | ✅ | — | ❌ | ❌ |
| Parada | ✅ | ✅ | ✅ | ❌ | ❌ |

**Gaps**: no hay estado `retry` (reintento manual) ni manejo explícito de `offline`. Para Fase 3 conviene un componente de error+retry reutilizable y un mensaje de red caída.

## 22. Expo health

`npx expo-doctor` → **19/21 checks passed, 2 failed**:

| Check | Severidad | Nota |
|---|---|---|
| Hermes V1 regressions | SAFE TO DEFER | Aviso conocido de Expo para SDK 57 (no bloquea build; ya documentado en fases previas) |
| Packages no coinciden con SDK | IMPORTANT | Hay 19 paquetes con parches más nuevos (ej. `expo-router ~57.0.17` vs instalado `57.0.3`). `npx expo install --check` los lista. **No actualizar durante la auditoría**; evaluar en Fase 3 |

## 23. iOS/Android readiness

- **iOS**: `bundleIdentifier: ec.edu.ups.expresos`, scheme `upsexpresosmobile`. Sin archivo `ios/` (prebuild).
- **Android**: `package: ec.edu.ups.expresos`, `android/` generado por prebuild (gitignored), dev build con `expo-dev-client` ya compilado previamente.
- **eas.json**: perfiles `preview` (apk, internal) y `production` (app-bundle). `projectId` de EAS configurado.
- **No hay builds publicados ni certificados gestionados en esta auditoría** (fuera de alcance). Readiness: estructura lista; el dev build Android ya se probó localmente en fases previas.

## 24. Tests

- **Estado**: 11 suites, **63 tests**, todos PASS.
- Cobertura: cliente HTTP (14 — refresh, dedup, logout RC2, fail-fast), auth service (4), mobile service (5), AuthContext (3), utils (schedule 6, routes 4, pagination 7, htmlEscape 8, scriptJson 6), Colors (4), smoke (2).
- Mocks tipados (sin `any`). No hay React Native Testing Library ni snapshots de pantallas.

**Tests mínimos propuestos Fase 3**: auth (request/verify/me), session restore, routes list, route detail + currentOperation, notices, API error handling (timeout/429), favoritos locales.

## 25. Backend contract gaps

| # | Endpoint | Comportamiento actual | Comportamiento requerido | Impacto mobile | Recomendación |
|---|---|---|---|---|---|
| 1 | `GET /mobile/routes` y `GET /mobile/routes/:id` | Devuelven `currentOperation` (nullable) | La app debe tiparlo y consumirlo | Actualmente la app ignora el campo (sin romper, solo invisible) | **Gap de integración (no bug)**: agregar tipo + UI en Fase 3. No requiere cambio backend |

**Nota**: No se encontraron desajustes de contrato bloqueantes en los endpoints que la app usa (`/auth/*`, `/mobile/*`). El tipo `RouteDetail` ya está alineado con el shape `{ route, stops, schedules }` del backend (corregido en fases previas).

## 26. KEEP / ADAPT / REFACTOR / REMOVE

| Archivo | Clasificación | Razón |
|---|---|---|
| `src/api/client.ts` | **KEEP** | Cliente HTTP robusto: fail-fast, refresh dedup, retry, SecureStore |
| `src/context/AuthContext.tsx` | **KEEP** | Auth completo con restore + logout + sync de rotación |
| `src/services/auth.service.ts` | **KEEP** | Contratos alineados |
| `src/services/mobile.service.ts` | **ADAPT** | Agregar tipos con `currentOperation`; posible `tripFeedback` |
| `src/context/RoutesContext.tsx` | **ADAPT** | Agregar badge de operación; evaluar TanStack Query |
| `src/app/(tabs)/index.tsx` | **ADAPT** | Consumir `currentOperation` para destacar ruta activa |
| `src/app/(tabs)/rutas.tsx` | **ADAPT** | Agregar estado operativo por ruta |
| `src/app/route/[id].tsx` | **ADAPT** | Mostrar conductor/vehículo/estado; fix typedRoutes |
| `src/types/route.ts` | **ADAPT** | Agregar `currentOperation` |
| `src/app/(tabs)/favoritos.tsx`, `FavoritesContext`, `FavoriteStopsContext` | **KEEP** | Favoritos locales correctos para MVP |
| `src/components/LeafletMap.tsx` | **KEEP** | Mapa sin GPS, correcto para MVP |
| `src/app/map/[id].tsx`, `stop/[id].tsx` | **KEEP** | Detalle de paradas correcto |
| `src/app/(tabs)/avisos.tsx` | **KEEP** | Avisos con API real + paginación |
| `src/app/(tabs)/perfil.tsx` | **KEEP** | Perfil + logout; roleMap con DRIVER |
| `src/utils/*` | **KEEP** | Utilidades correctas y probadas |
| `src/app/(tabs)/index.tsx` (Schedule) | **REFACTOR** (menor) | Evitar re-fetch de schedules en cada mount |
| `src/app/route/[id].tsx` etc. (router.push string) | **REFACTOR** (menor) | Usar objeto Href para typedRoutes |

**REMOVE**: no se identificó código muerto de producto (el starter ya fue limpiado en fases previas).

## 27. Riesgos

### CRITICAL
- **Typecheck falla** (`tsc --noEmit` con 3 errores de `typedRoutes`). No bloquea el dev/build (Metro transpila), pero es deuda que debe cerrarse antes de mergear Fase 3.

### HIGH
- Ninguno identificado.

### MEDIUM
- `currentOperation` del backend invisible en la app (Fase 3 lo resuelve).
- Ausencia de FlatList en listas (7 ScrollView).
- Estado de error/retry/offline incompleto en pantallas.

### LOW
- 26 warnings de react-hooks (degradados a warning).
- 19 paquetes con parches más nuevos (expo-doctor IMPORTANT).
- Aviso Hermes V1 (expo-doctor).
- Routing OSRM externo (dependencia de red de terceros) en el mapa.
- Re-fetch de schedules en Home por mount.

## 28. Plan propuesto para Fase 3 (STUDENT)

Paso 0 — **Prerequisito**: corregir los 3 errores de typecheck (typedRoutes) usando objeto `Href` en `router.push`.

1. **Auth** (mantener): ya funcional. Ajustar si se requiere `devCode` en dev o manejo explícito de 429 en OTP.
2. **Tipos**: agregar `currentOperation` y tipos de Trip Feedback a `types/route.ts`.
3. **Home**: mostrar estado operativo de la ruta destacada (badge "En recorrido"/"Programado", conductor, vehículo).
4. **Rutas (lista)**: badge `currentOperation` por ruta (status + placa).
5. **Detalle de ruta**: mostrar conductor, vehículo, estado, `startedAt`; agrupar horarios ida/retorno con etiquetas.
6. **Mapa**: (sin cambios) — ya muestra paradas.
7. **Avisos**: (sin cambios) — ya funcional.
8. **Trip Feedback**: pantalla de calificar viaje (estrellas + comentario, `POST /trip-feedback`) + historial (`GET /trip-feedback`).
9. **Perfil**: (sin cambios) — logout ya funciona; agregar si hace falta versión/ayuda.
10. **UX**: componente reutilizable de error+retry; mensaje de red caída.
11. **Evaluar TanStack Query** para server-state de rutas/avisos sin romper los contextos actuales.
12. **Tests**: agregar los propuestos en §24.

**NO incluir**: GPS, ETA, push, background location, Driver Experience funcional, reservas, pagos.

## 29. Criterios de GO / NO-GO

GO para Fase 3 cuando:
- `tsc --noEmit` pasa (0 errores).
- Tests 63+ siguen en verde tras el fix de typedRoutes.
- Los tipos `currentOperation`/TripFeedback están definidos y consumidos.
- La app sigue corriendo en el dev build (Android/iOS) sin regresión.

NO-GO si:
- No se resuelve el typecheck.
- Algún fix rompe la sesión/refresh (AuthContext/client.ts).
- Se introduce `any` o se rompe el fail-fast del cliente HTTP.

## 30. Archivos que probablemente deberán cambiar en Fase 3

- `src/app/(auth)/login.tsx` (menor: devCode/429)
- `src/app/(auth)/otp.tsx` (menor: manejo 429)
- `src/app/(tabs)/index.tsx` (Home + currentOperation)
- `src/app/(tabs)/rutas.tsx` (badge currentOperation)
- `src/app/route/[id].tsx` (detalle + conductor/vehículo + fix typedRoutes)
- `src/app/map/[id].tsx` (fix typedRoutes)
- `src/app/stop/[id].tsx` (fix typedRoutes)
- `src/types/route.ts` (currentOperation)
- `src/services/mobile.service.ts` (tipos + posible tripFeedback)
- `src/context/RoutesContext.tsx` (menor)
- `src/components/` (nuevo: ErrorRetry, Badge estado)
- `src/app/(tabs)/favoritos.tsx` (menor, si se agrega badge)
- Nuevo: pantalla de Trip Feedback (o modal)
- `jest.setup.js` / tests nuevos

**No modificados en Fase 2** (solo auditoría, sin cambios).

## 31. Evidencia de validaciones

| Comando | Resultado | Observación |
|---|---|---|
| `npm install` | PASS | Dependencies up to date (warnings de audit no bloqueantes) |
| `npx expo-doctor` | **19/21 PASS, 2 FAIL** | Hermes V1 (defer) + packages desactualizados (IMPORTANT, no actualizar en auditoría) |
| `npx tsc --noEmit` | **FAIL (3 errores)** | typedRoutes: `router.push("/route/" + id)` en favoritos, route/[id], stop/[id] |
| `npm run lint` | PASS | 0 errores, 26 warnings (react-hooks degradados a warning en eslint.config.js) |
| `npm test` | **PASS — 11 suites, 63 tests** | Todos verdes |
| `npx expo export --platform android` | PASS | Bundle android 5.3MB generado en dist/ (gitignored) |
| `git status` | PASS (limpio) | Rama `audit/mobile-mvp-baseline` sin cambios de auditoría |

**Conclusión**: baseline funcional y testeable. El único bloqueo para Fase 3 es el typecheck (3 errores de typed routes, fix trivial con objeto Href).
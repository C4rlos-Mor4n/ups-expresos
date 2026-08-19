# UPS EXPRESOS MOBILE — PHASE 1 TECHNICAL AUDIT

Fecha: 2026-08-19
App auditada: `/home/cmoran/ups-expreso/ups-expresos-mobile` (Expo SDK 57)
Backend (fuente de verdad): `/home/cmoran/ups-expreso/ups-api`
Modo: SOLO LECTURA (read-only). Se generó únicamente este reporte; no se modificó código productivo.

---

## 1. Executive Summary

```text
Overall status:      NEEDS WORK
Production readiness: NO
Cleanup readiness:   CONDITIONAL GO
```

La app **no compila en TypeScript** (2 errores de tipos), **no tiene tests**, **no tiene lint configurado de forma segura** (el script `expo lint` auto-instala eslint y modifica archivos), y **expo-doctor falla** (2 checks: regresión de memoria de Hermes V1 + paquetes desactualizados respecto al SDK). Además hay **un desajuste de contrato confirmado** en el detalle de ruta (la app tipa plano `RouteDetail` pero el backend devuelve `{ route, stops, schedules }`), un **logout que no revoca la sesión en el backend** (401 por falta de header de auth), y una **gran cantidad de código muerto del starter de Expo** (componentes, hooks, constantes, tipos, assets y 4 archivos vacíos).

La arquitectura activa (auth con SecureStore, expo-router, contextos, servicios) es coherente en lo esencial y los flujos principales (request-code → verify-code → sesión → tabs) están razonablemente implementados. Pero la base NO está lista para producción tal como está: primero hay que restaurar el typecheck, alinear el contrato de `/mobile/routes/:id`, arreglar el logout y decidir sobre el starter muerto.

---

## 2. Repository Baseline

```text
Branch:            N/A (la carpeta ups-expresos-mobile NO es un repositorio git)
SHA:               N/A (no existe .git)
Working tree before: N/A (sin VCS)
Working tree after:  N/A (sin VCS)
```

Nota: `/home/cmoran/ups-expreso` no es repo git. `ups-api` sí lo es (main @ c5d46b2, working tree ya sucio de sesiones previas, no causado por esta auditoría). El directorio mobile no tiene control de versiones.

### Advertencia de integridad (transparencia)
Para poder ejecutar el baseline fue necesario `npm ci` (instala en `node_modules/`, gitignored, no toca tracked). Al ejecutar el script soportado `npm run lint` (= `expo lint`), Expo **auto-instaló eslint y modificó `package.json`, `package-lock.json` y creó `eslint.config.js`**. Esto violó la regla read-only de forma involuntaria. Se restauró el estado:
- `package.json` devuelto a su contenido original (devDeps solo `@types/react` + `typescript`, sin eslint). Verificado.
- `eslint.config.js` eliminado. Verificado.
- `package-lock.json` reconciliado con `npm install` para quitar eslint (queda 318 KB vs 326 KB originales; semánticamente consistente con el package.json original, no byte-idéntico por falta de backup).
- Ningún archivo de `src/`, `app.json`, `tsconfig.json`, `eas.json` fue modificado (mtimes originales intactos).

Este incidente además es un **hallazgo del proyecto**: `npm run lint` no es seguro de ejecutar porque `expo lint` modifica archivos tracked al no tener eslint declarado como devDependency.

---

## 3. Technology Inventory

| Technology | Version | Status | Notes |
|---|---|---|---|
| Expo SDK | 57.0.2 (instalado) / espera ≥57.0.9 | WARN | Hermes V1 regression |
| React | 19.2.3 | OK | |
| React Native | 0.86.0 (espera 0.86.2+) | WARN | Hermes fix en 0.86.2 |
| TypeScript | ~6.0.3 | OK | muy reciente |
| Expo Router | ~57.0.3 | OK | typedRoutes ON |
| React Compiler | habilitado | OK | `experiments.reactCompiler` |
| Package manager | npm 11.17 (lockfile v3) | OK | `package-lock.json` |
| Node | v24.19.0 | OK | |
| Plataformas | ios, android, web | OK | `web.output: static` |
| EAS | projectId `fc601b8b-...` | OK | solo perfiles android |
| Strict TS | `strict: true` | OK | hereda expo/tsconfig.base |
| Aliases | `@/*` → `./src/*`, `@/assets/*` → `./assets/*` | OK | |
| .env | presente (63 B) | — | define `EXPO_PUBLIC_API_URL` (valor NO leído) |

### Dependencias principales
`expo`, `expo-router`, `react`, `react-native`, `axios`, `@expo/vector-icons`, `lucide-react-native`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `expo-image`, `expo-haptics`, `react-native-webview`, `react-native-reanimated`, `@expo-google-fonts/inter`, `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `react-native-safe-area-context`, `react-native-svg`, `react-native-screens`, `react-native-gesture-handler`, `react-native-web`.

---

## 4. Automated Validation

| Check | Result | Evidence |
|---|---|---|
| Install | PASS | `npm ci` → 640 packages, exit 0 |
| Typecheck | **FAIL** | `npx tsc --noEmit` → 2 errores TS2307/TS2882 |
| Lint | **FAIL** | `expo lint` auto-instala eslint y modifica tracked files; falla `Cannot find module 'eslint'`; no hay config de eslint declarada |
| Tests | **NONE** | no hay *.test/*.spec, ni jest/vitest, ni script de test |
| Expo Doctor | **FAIL** | 19/21 checks; falla Hermes V1 regression y versiones de paquetes |
| Expo validation | PASS | `npx expo config` → exit 0, plataformas ios/android/web |

**Typecheck FAIL — errores exactos:**
```
src/components/animated-icon.web.tsx(5,21): error TS2307: Cannot find module './animated-icon.module.css' or its corresponding type declarations.
src/constants/theme.ts(6,8): error TS2882: Cannot find module or type declarations for side-effect import of '@/global.css'.
```
Ambos provienen de la capa muerta del starter (animated-icon.web importa un CSS module; theme.ts importa global.css). No hay declaraciones de tipos para CSS.

**Expo Doctor FAIL — checks:**
1. "Check for Expo SDK versions affected by Hermes V1 regressions": usa Hermes V1 250829098.0.14 (RN 0.86.0) con una regresión de memoria conocida; fix en 250829098.0.16 (RN 0.86.2 / expo ≥57.0.9).
2. "Check that packages match versions required by installed Expo SDK": 19 paquetes desactualizados (lockfile con parches viejos: expo 57.0.2 vs 57.0.14, etc.).

**Vulnerabilidades (npm audit):** 20 (8 moderate, 12 high). NO se ejecutó `npm audit fix` (no tocar).

---

## 5. Findings Summary

| Severity | Count |
| -------- | ----: |
| CRITICAL |     0 |
| HIGH     |     4 |
| MEDIUM   |     8 |
| LOW      |    10 |

---

## 6. CRITICAL Findings

No se encontraron hallazgos CRITICAL (no hay bypass de autenticación con impacto total, ni exposición de credenciales con acceso, ni crash sistemático del flujo de login en condiciones normales).

---

## 7. HIGH Findings

### H1. Contrato del backend mal tipado: `GET /mobile/routes/:id` se tipa plano pero el backend devuelve `{ route, stops, schedules }`
```
ID: H1
Severity: HIGH
Category: API Contract / Type Safety
File: src/services/mobile.service.ts:12-15 (getRouteDetail): Promise<RouteDetail>
      + src/app/map/[id].tsx:40, src/app/route/[id].tsx:77, src/context/FavoritesContext.tsx:73
Finding: El servicio declara getRouteDetail(): Promise<RouteDetail> (forma plana: Route & { stops, schedules }), pero el backend (MobileService.findRouteDetail → MobileRouteDetailResponseDto) devuelve { route: Route, stops, schedules }. Tres consumidores lo "arreglan" con `as any` para desempaquetar.
Evidence: ups-api/src/modules/mobile/mobile.service.ts devuelve { route, stops, schedules }; dto/mobile-route-detail-response.dto.ts define route/stops/schedules. En la app: map/[id].tsx:40 `const responseData = data as any; if (responseData.route)...`; route/[id].tsx:77-78 `const rd = data as any; setRoute({ ...rd.route, stops: rd.stops, ...})`; FavoritesContext.tsx:73.
Current behavior: El tipado no refleja la realidad; el `as any` apaga el compilador y oculta el desajuste.
Expected behavior: Tipar getRouteDetail con la forma real { route, stops, schedules } y hacer el mapeo en el servicio.
Technical impact: Si el backend cambiara a la forma plana (o la app asumiera la plana), rd.route sería undefined → la ruta se renderizaría rota/vacía sin error de compilación.
Business/user impact: Riesgo latente de mostrar una ruta vacía/rota; mantenibilidad baja.
Risk: Medium (latente, no roto hoy porque el backend sí devuelve la forma envuelta).
Recommended correction: Corregir el tipo del servicio a RouteDetailResponse { route, stops, schedules } y mapear en el servicio; eliminar los `as any`.
Breaking change: NO (interno a la app).
Confidence: HIGH
```

### H2. Logout no revoca la sesión en el backend (401 por falta de header de auth)
```
ID: H2
Severity: HIGH
Category: Authentication / Session lifecycle
File: src/services/auth.service.ts:46-49 (logout usa api de client.ts)
      src/api/client.ts (sin interceptor de auth)
      src/context/AuthContext.tsx:75-91 (logout)
Finding: El backend exige JWT en POST /auth/logout (no es @Public). La app llama authService.logout() con client.ts, que NO tiene interceptor que agregue `Authorization: Bearer`. El request va sin token → 401. AuthContext.logout() captura el error y borra tokens localmente, por lo que el usuario "ve" que cerró sesión, pero la sesión/refresh token del backend queda VÁLIDA.
Evidence: ups-api auth.controller.ts logout NO es @Public() y usa @ApiBearerAuth; app client.ts (5-10) no agrega Authorization; AuthContext.tsx:77-82 try { await authService.logout(refreshToken) } catch { ...continúa borrado local }.
Current behavior: El logout local limpia tokens pero el backend nunca revoca la sesión.
Expected behavior: Enviar el Bearer token (usar la instancia con interceptor, o agregar header) para revocar la sesión; si falla, al menos marcar el token revocado localmente.
Technical impact: El refresh token sigue válido en el servidor → una sesión "cerrada" puede reutilizarse.
Business/user impact: Riesgo de seguridad (sesión zombie); el servidor acumula sesiones no revocadas.
Risk: Medium (requiere acceso al token para explotar; impacto en higiene de sesiones).
Recommended correction: Usar la instancia de api con interceptor (services/api.ts) para logout, o agregar el header Bearer explícito.
Breaking change: NO
Confidence: HIGH
```

### H3. `npm run lint` (expo lint) modifica archivos tracked y no se puede ejecutar de forma segura
```
ID: H3
Severity: HIGH
Category: Tooling / Repo integrity
File: package.json:51 ("lint": "expo lint"); no hay eslint declarado en devDependencies
Finding: Al ejecutar `npm run lint`, `expo lint` auto-instala eslint y eslint-config-expo, modifica package.json/package-lock.json y crea eslint.config.js, y además falla (Cannot find module 'eslint'). Es imposible correr lint sin alterar el repo.
Evidence: Ejecución real durante esta auditoría (auto-install + modificación de tracked files). package.json no declara eslint.
Current behavior: `expo lint` no es reproducible; corrompe la integridad del repo.
Expected behavior: Declarar eslint/eslint-config-expo como devDependencies y commitear eslint.config.js, o no exponer el script.
Technical impact: Cualquier CI que corra `npm run lint` modificaría el repo y fallaría.
Business/user impact: Bloquea la verificación de calidad de forma limpia.
Risk: Medium
Recommended correction: Declarar eslint + eslint-config-expo en devDependencies y crear eslint.config.js versionado (paso de limpieza Fase 2).
Breaking change: NO
Confidence: HIGH
```

### H4. Screens de detalle (`route/[id]`, `map/[id]`, `stop/[id]`) no están protegidos por el guard de autenticación
```
ID: H4
Severity: HIGH
Category: Navigation / Auth
File: src/app/_layout.tsx:26-40 (guard solo redirige si está dentro de "(tabs)")
      src/app/route/[id].tsx, map/[id].tsx, stop/[id].tsx (fuera de (tabs))
Finding: El guard de AppContent solo re-dirige cuando `!isAuthenticated && inTabsGroup`. Los screens route/map/stop/[id] están FUERA del grupo (tabs) y fuera del Stack de (tabs); un deep link directo (o navegación) a ellos sin sesión entra y dispara requests a /mobile/* que responden 401.
Evidence: _layout.tsx:30 `const inTabsGroup = segments[0] === "(tabs)";` — route/map/stop no están en (tabs). Estos screens llaman mobileService.getRouteDetail/getRouteStops (protegidos) sin verificar isAuthenticated.
Current behavior: Sin sesión, un deep link a /route/:id intenta cargar y falla (error/loading) en vez de redirigir a login.
Expected behavior: Proteger todas las rutas autenticadas, incluidas las de detalle fuera de (tabs), redirigiendo a la welcome/login cuando no hay sesión.
Technical impact: Exposición de pantallas que requieren datos autenticados sin guard; UX rota en deep links.
Business/user impact: Deep link compartido a una ruta abre una pantalla rota para usuarios no logueados.
Risk: Low-Medium (el backend igual protege los datos; es más un problema de UX/consistencia de navegación).
Recommended correction: Ampliar el guard para cubrir route/[id], map/[id], stop/[id], o moverlos bajo un layout protegido.
Breaking change: NO
Confidence: HIGH
```

---

## 8. MEDIUM Findings

### M1. Regresión de memoria de Hermes V1 (expo 57.0.2 / RN 0.86.0)
```
ID: M1 | Severity: MEDIUM | Category: Performance/Stability
File: package.json (expo ~57.0.2, react-native 0.86.0); lockfile
Evidence: expo-doctor: "Hermes V1 250829098.0.14 ... affected by a known memory regression ... 250829098.0.16 is the first version that contains the fix" (RN 0.86.2 / expo ≥57.0.9).
Current: Memoria podría degradarse en sesiones largas. Expected: expo ≥57.0.9 / RN ≥0.86.2. Impact: estabilidad en dispositivos con poca RAM. Risk: Medium. Recommended: `npx expo install expo@^57.0.9 --fix` (Fase 2). Breaking: NO. Confidence: HIGH.
```

### M2. Dos instancias axios divergentes y duplicación del cliente HTTP
```
ID: M2 | Severity: MEDIUM | Category: Architecture / HTTP
File: src/api/client.ts (sin interceptores, baseURL sin fallback) vs src/services/api.ts (con interceptores de token/refresh, fallback ngrok, header ngrok, logs).
Evidence: client.ts:4-10 (baseURL solo env); services/api.ts:5-73 (interceptor 401→refresh, logs BODY). authService usa client.ts; mobileService usa services/api.ts.
Current: Configuración HTTP duplicada y divergente (el auth no refresca ni envía token; el mobile sí). Expected: un único cliente HTTP con interceptores centralizados. Impact: mantenibilidad y comportamiento inconsistente (H2 es consecuencia). Risk: Medium. Recommended: unificar en un solo cliente. Breaking: NO. Confidence: HIGH.
```

### M3. Logging de datos sensibles en el interceptor (params y cuerpo completo de errores)
```
ID: M3 | Severity: MEDIUM | Category: Security/Logging
File: src/services/api.ts:17-20 (console.log params por request), :65-69 (console.log "BODY:", error.response.data).
Evidence: api.ts imprime config.params en cada petición y el cuerpo completo de respuestas de error.
Current: Logs ruidosos y potencialmente sensibles en cada request/error. Expected: logging a nivel debug/error, recortado, sin datos sensibles. Impact: exposición de datos en logs/consola. Risk: Medium (en dev principalmente; en prod sería un riesgo si se captura). Recommended: quitar o condicionar a NODE_ENV=development y no loguear bodies. Breaking: NO. Confidence: HIGH.
```

### M4. Fallback hardcodeado a URL de ngrok obsoleta en el cliente
```
ID: M4 | Severity: MEDIUM | Category: Config/Security
File: src/services/api.ts:6 (baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://robust-strong-cattle.ngrok-free.app')
Evidence: Fallback a un túnel ngrok que ya no corresponde al backend real (removido también de la doc del backend).
Current: Si EXPO_PUBLIC_API_URL no está, la app apunta a un ngrok obsoleto/posiblemente caído. Expected: sin fallback a entornos muertos; error claro si falta la var. Impact: fallos de conexión en builds sin .env correcto; URL de terceros en el bundle. Risk: Medium. Recommended: quitar el fallback ngrok. Breaking: NO. Confidence: HIGH.
```

### M5. N+1 de red en `stop/[id].tsx` (fetch de stops de TODAS las rutas)
```
ID: M5 | Severity: MEDIUM | Category: Performance/Data fetching
File: src/app/stop/[id].tsx:53-65 (Promise.all de routes.map(getRouteStops))
Evidence: Para una parada se itera todas las rutas y se hace una petición HTTP por ruta (getRouteStops) para saber cuáles pasan por la parada.
Current: Coste O(n) requests al entrar a una parada; lento y costoso con muchas rutas. Expected: un endpoint/estrategia que resuelva "rutas por parada" en una sola consulta. Impact: latencia y consumo de red/API. Risk: Medium. Recommended: exponer endpoint de rutas-por-parada o resolver en el detalle de ruta. Breaking: NO. Confidence: HIGH.
```

### M6. Screens con `ScrollView` + `.map` (sin virtualización) para listas
```
ID: M6 | Severity: MEDIUM | Category: Performance
File: src/app/(tabs)/rutas.tsx:102-144, avisos.tsx:130-174, favoritos.tsx:55-137, index.tsx (ScrollView), stop/[id].tsx
Evidence: rutas/avisos/favoritos usan ScrollView con .map sobre arrays (rutas, avisos, favoritos). 
Current: Todos los ítems se montan (sin windowing). Con listas modestas es aceptable; con muchas rutas/avisos degrada.
Expected: FlatList (o FlashList) para listas potencialmente grandes.
Impact: render costoso si crecen los datos. Risk: Medium (depende del volumen real; hoy probablemente bajo). Recommended: evaluar volumen; migrar a FlatList si supera ~20-30 ítems. Breaking: NO. Confidence: MEDIUM.
```

### M7. Paginación no implementada en el cliente (solo se cargan los primeros N)
```
ID: M7 | Severity: MEDIUM | Category: Data fetching / Contract
File: src/services/mobile.service.ts (getRoutes/getNotices sin params), RoutesContext.tsx:40, avisos.tsx:42
Evidence: getRoutes() y getNotices() se llaman sin page/limit; el backend pagina con default (limit 20). El cliente no carga más (sin "load more" ni scroll infinito).
Current: Solo se muestran las primeras 20 rutas/avisos; sin forma de ver el resto.
Expected: paginación (cargar más / scroll) o confirmar que el volumen no lo requiere.
Impact: datos incompletos si hay >20 registros. Risk: Medium. Recommended: implementar carga incremental o confirmar alcance. Breaking: NO. Confidence: HIGH.
```

### M8. "Próximo horario" en Home muestra el primer horario, no el próximo real
```
ID: M8 | Severity: MEDIUM | Category: Bug (logic)
File: src/app/(tabs)/index.tsx:35-37 (schedules[0].departureTime como "nextSchedule")
Evidence: Se muestra schedules[0] (primer horario de la lista) etiquetado como "Próximo horario cercano", sin filtrar por día/hora actual. Puede ser un horario pasado o de otro día.
Current: El dato mostrado como "próximo" no es necesariamente el próximo. Expected: calcular el próximo horario respecto a now (día + hora). Impact: información engañosa al usuario. Risk: Medium. Recommended: filtrar/ordenar por día y hora próximos. Breaking: NO. Confidence: HIGH.
```

---

## 9. LOW Findings

### L1. `@react-navigation/native-stack` no se usa (expo-router vende su propio stack)
```
ID: L1 | File: package.json:11 | Evidence: 0 imports en src; expo-router no lo requiere. Recommended: remover (Fase 2). Confidence: HIGH.
```

### L2. `expo-device`, `expo-system-ui` sin uso (ni en src ni requeridos transitivamente)
```
ID: L2 | File: package.json:15,26 | Evidence: "no references found". Recommended: remover. Confidence: HIGH.
```

### L3. `expo-glass-effect`, `@expo/ui`, `expo-constants`, `expo-linking` redundantes (ya son deps de expo-router/expo)
```
ID: L3 | File: package.json | Evidence: no se importan en src; ya provistos transitivamente. Recommended: evaluar remover. Confidence: MEDIUM.
```

### L4. `lucide-react-native` duplica funcionalidad de `@expo/vector-icons` (solo 3 iconos en 1 archivo)
```
ID: L4 | File: package.json:28, src/app/(tabs)/index.tsx:11-15 | Evidence: MapPin/Bell/Star sustituibles por Ionicons. Recommended: unificar en @expo/vector-icons. Confidence: HIGH.
```

### L5. Casts `as any` evitables (no rompen contrato, pero debilitan tipos)
```
ID: L5 | File: src/app/(auth)/otp.tsx:61 (response.user as any), login.tsx:45 (catch (error: any)), stop/[id].tsx:58 ((s: any)), avisos.tsx:143 (config.icon as any) | Recommended: tipar correctamente (AuthUser, AxiosError, RouteStop, tipo de icono). Confidence: HIGH.
```

### L6. `as string` sobre router params (aceptable, estándar) y `filter(Boolean) as Route[]`
```
ID: L6 | File: map/[id]:31,88; route/[id]:70; stop/[id]:39,77,78; stop/[id]:66 | Clasificación: JUSTIFICADO/MEJORABLE (mejor type-guard). Confidence: HIGH.
```

### L7. `getMe` definido pero nunca usado y basado en client.ts sin auth (roto de facto)
```
ID: L7 | File: src/services/auth.service.ts:51-54 | Evidence: getMe usa api (client.ts) sin token → 401; no se llama en la app. Recommended: eliminar o corregir. Confidence: HIGH.
```

### L8. Pantalla `(auth)/welcome.tsx` es placeholder muerto (la welcome real es `index.tsx`)
```
ID: L8 | File: src/app/(auth)/welcome.tsx | Evidence: "Welcome UPS Expresos"; nada navega a ella. Recommended: eliminar (Fase 2). Confidence: HIGH.
```

### L9. `download-fonts.js` huérfano (no referenciado, escribe a assets/fonts/ que no existe)
```
ID: L9 | File: download-fonts.js | Evidence: no está en package.json; las fuentes se cargan de @expo-google-fonts/inter. Recommended: eliminar. Confidence: HIGH.
```

### L10. `reset-project.js` es el script destructivo del starter (si se ejecuta borra /src)
```
ID: L10 | File: scripts/reset-project.js, package.json:47 | Evidence: script oficial del starter que resetea el proyecto. Recommended: eliminar script + entrada de package.json (Fase 2). Confidence: HIGH.
```

### L11. `APP_VERSION` hardcodeado en perfil (duplica app.json)
```
ID: L11 | File: src/app/(tabs)/perfil.tsx:17 | Evidence: const APP_VERSION="1.0.1"; puede desincronizarse de app.json. Confidence: HIGH.
```

### L12. `StatusBar` importado de react-native en varios screens y header padding manual (no usa safe-area ni headers nativos)
```
ID: L12 | File: rutas.tsx:10,155; favoritos.tsx:8,157; perfil.tsx:8,197; map/route/stop (paddingTop: 55) | Evidence: padding manual para status bar en vez de useSafeAreaInsets/headers nativos. Riesgo de layout en distintos dispositivos. Confidence: MEDIUM.
```

---

## 10. TypeScript / Type Safety

```text
Strict mode:      YES (tsconfig extends expo/tsconfig.base + strict: true)
Typecheck:        FAIL (2 errores: animated-icon.web.tsx CSS module + theme.ts global.css)
any occurrences:  7 (5 usos reales + 2 anotaciones catch)
as any:           5 (3 riesgosos por contrato: map/[id]:40, route/[id]:77, FavoritesContext:73; 1 evitable: otp:61; 1 en catch: login:45)
ts-ignore:        0
unsafe casts:     11 casts `as X` (5 son router params justificados)
non-null `!`:     0
unknown:          0
```

### Verdict
```text
Type safety verdict: ACCEPTABLE (con problemas puntuales)
```
La app usa `strict: true` y no hay `any`/`@ts-ignore` sistemáticos (bien). El problema principal de tipos es el desajuste del contrato de `/mobile/routes/:id` oculto por `as any` (H1), y el hecho de que **el proyecto no compila** por los CSS imports del starter muerto. `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` NO están habilitados (no son obligatorios; implican más `undefined` handling del que hoy se maneja). El `role` está tipado como unión en `AuthUser` pero el backend lo devuelve como `string`; se reconcilia con el cast en otp.tsx.

---

## 11. Architecture

Evaluación por carpeta:

```text
src/app          GOOD      expo-router correcto: grupos (auth)/(tabs), rutas dinámicas [id], _layout con providers
src/api          POOR      client.ts es un segundo cliente HTTP casi vacío que duplica services/api.ts (M2)
src/services     ACCEPTABLE auth.service (client.ts) y mobile.service (api.ts) — duplicación y contrato plano (H1)
src/context      ACCEPTABLE 5 contextos; ThemeContext es estático (no adapta dark), RoutesContext=server state en Context con caché
src/components   POOR      mayoría del starter muerto (ver Dead Code); activo: LeafletMap
src/hooks        POOR      solo hooks del starter (dead)
src/types        ACCEPTABLE user.ts y schedule.ts VACÍOS; varios tipos muertos; contrato plano (H1)
src/constants    ACCEPTABLE Colors.ts (UPS) activo; theme.ts (starter) y storage.ts muertos
```

La arquitectura activa (auth + router + contextos + servicios) es coherente en lo esencial. Los problemas son: duplicación HTTP, capa del starter muerta mezclada con la app real, y server-state en Context sin una capa de data-fetching dedicada (se resuelve con fetch manual + caché AsyncStorage).

---

## 12. API Contract Compliance

```text
Resultado: PARTIAL (con 1 MISMATCH confirmado y varios partial mismatches menores)
```

Matriz endpoint por endpoint:

| Mobile function | Method | Endpoint | Request | Response (app) | Backend (verdad) | Match | Observaciones |
|---|---|---|---|---|---|---|---|
| `authService.requestCode` | POST | /auth/request-code | {email} | {message, devCode?} | {message, devCode?} | MATCH | |
| `authService.verifyCode` | POST | /auth/verify-code | {email, code} | {accessToken, refreshToken, user} | AuthTokensDto (idem) | MATCH | `user.role` string vs union (cast en otp) |
| `authService.refreshTokens` | POST | /auth/refresh | {refreshToken} | {accessToken, refreshToken, user} | AuthTokensDto | MATCH | |
| `authService.logout` | POST | /auth/logout | {refreshToken} | {message} | {message} (requiere JWT) | MATCH (payload) pero 401 sin token | H2 |
| `authService.getMe` | GET | /auth/me | - | user | AuthUserDto | MATCH (payload) pero roto (client.ts sin auth) | L7 |
| `mobileService.getRoutes` | GET | /mobile/routes | {page,limit,status,search} | PaginatedResponse<Route> | PaginatedResponse<RouteResponseDto> | MATCH (parcial: `description` opcional/null en backend, string en app) | sin paginación cliente (M7) |
| `mobileService.getRouteDetail` | GET | /mobile/routes/:id | - | RouteDetail (plano) | **{ route, stops, schedules }** | **MISMATCH** | H1 |
| `mobileService.getRouteStops` | GET | /mobile/routes/:id/stops | - | RouteStop[] (con `stopId`) | MobileRouteStopResponseDto[] (SIN `stopId`) | PARTIAL | `stopId` no existe en backend; `estimatedArrivalMinutes`/`notes` opcionales en backend, requeridos en app |
| `mobileService.getRouteSchedules` | GET | /mobile/routes/:id/schedules | {dayOfWeek,direction} | Schedule[] | ScheduleResponseDto[] | PARTIAL | `approximateArrivalTime` opcional/null en backend, requerido en app |
| `mobileService.getNotices` | GET | /mobile/notices | {page,limit} | PaginatedResponse<Notice> | PaginatedResponse<MobileNoticeResponseDto> | PARTIAL | `isActive`,`createdAt`,`updatedAt` no existen en backend mobile DTO; sin paginación (M7) |

Observación transversal: en `getRoutes`, `getNotices` y `stop/[id]` la app usa `Array.isArray(response)` como fallback, evidencia de que el equipo no estaba seguro del shape exacto del contrato.

---

## 13. Authentication

Diagrama textual del flujo real:

```
APP START
  → RootLayout: carga fuentes (SplashScreen hasta fontsLoaded)
  → AuthProvider.loadSession(): lee SecureStore (access_token, refresh_token, user)
      → si existen: setUser/setAccessToken → isAuthenticated=true
      → NO valida expiración ni refresca al arrancar (confía en presencia)
  → index.tsx (Welcome): si autenticado → router.replace("/(tabs)")
  → si no: botón → (auth)/login

LOGIN
  → POST /auth/request-code (email) → router.push((auth)/otp?email=)
  → maneja 429 y mensaje de error

OTP
  → usuario ingresa 6 dígitos → autoverifica al completar
  → POST /auth/verify-code {email, code} → {accessToken, refreshToken, user}
  → login(accessToken, refreshToken, user as any) → persiste en SecureStore
  → router.replace("/(tabs)")
  → error: shake + limpia (sin mensaje específico)

SESIÓN
  → (tabs)/_layout: si loading → spinner; si isAuthenticated → tabs
  → AppContent (root): si !isAuthenticated y segmento "(tabs)" → redirige a "/"

TOKEN EXPIRACIÓN
  → services/api.ts interceptor: 401 → POST /auth/refresh → re-intenta
  → si refresh falla: borra tokens localmente (NO redirige a login explícito)

LOGOUT
  → perfil → AuthContext.logout() → authService.logout() (401 por client.ts sin token, H2)
  → borra SecureStore local → setUser(null)
```

Evaluación:
- **Persistencia**: tokens y user en `expo-secure-store` (buena práctica). ✅
- **Recuperación al reiniciar**: carga de SecureStore; pero **no valida ni refresca el token al arrancar** (una sesión expirada se considera "autenticada" hasta que un request dé 401). ⚠️
- **Refresh**: centralizado en `services/api.ts` (usado por mobile), con el problema de que **authService usa client.ts sin refresh**. No hay guard de concurrencia (varios 401 → múltiples refreshes). ⚠️
- **Logout**: **no revoca la sesión en el backend** (H2). ❌
- **Estados**: loading/authenticated/unauthenticated presentes en AuthContext y layouts. ✅
- **Race/estados parciales**: `isAuthenticated` se deriva de la presencia del access token, no de su validez; el arranque no valida. ⚠️

---

## 14. Navigation / Expo Router

- Estructura correcta: grupos `(auth)` y `(tabs)`, rutas dinámicas `route/[id]`, `map/[id]`, `stop/[id]`, layouts anidados, `typedRoutes` y `reactCompiler` habilitados.
- `(auth)/_layout.tsx` solo declara `<Stack.Screen name="login" />` (otp/welcome se auto-registran; no es un bug, pero es inconsistente declarar solo uno).
- **Guard incompleto**: solo protege `(tabs)`; `route/map/stop/[id]` quedan fuera (H4).
- `id` de `useLocalSearchParams` se castea `as string` (estándar para rutas dinámicas). Sin validación extra (aceptable).
- No hay deep-link handling explícito más allá de lo automático de expo-router.
- `welcome.tsx` (auth) es una ruta muerta/placeholder (L8).

---

## 15. State Management

| Context | Responsabilidad | Server state? | Persistencia | Veredicto |
|---|---|---|---|---|
| AuthContext | sesión/tokens | sí (tokens) | SecureStore | OK (salvo logout/validación) |
| ThemeContext | colores | no | no | **estático** (no adapta dark pese a `userInterfaceStyle: automatic`) |
| RoutesContext | lista de rutas | **sí** (server state) | AsyncStorage caché | fetch + caché manual (revalidate) |
| FavoritesContext | rutas favoritas | mixto (fetch detalle) | AsyncStorage | usa `as any` (H1) |
| FavoriteStopsContext | paradas favoritas | no | AsyncStorage | OK |

No hay Redux/Zustand/TanStack. El server state se maneja con Context + fetch manual + AsyncStorage. Esto NO se recomienda cambiar automáticamente (la skill lo prohíbe sin problema demostrado); el problema demostrado es la duplicación de lógica de fetch y la falta de invalidación/caché unificada, no la librería en sí. Render impact: providers anidados razonable; no se observan rerenders globales excesivos fuera de lo normal.

---

## 16. Data Fetching

- Fetch manual con `useEffect`/`useFocusEffect` en screens (avisos, stop, index) y en contextos (Routes).
- **Duplicación**: `Array.isArray(response)` fallback en rutas/avisos/stop (incertidumbre de contrato).
- **Sin cancelación** de requests al desmontar (posibles setState en componente desmontado en caso de race).
- **Sin caching unificado** (AsyncStorage manual en RoutesContext/Favorites).
- `RoutesContext` hace stale-while-revalidate (caché → fetch en segundo plano) — patrón razonable.
- `avisos.tsx` y `index.tsx` hacen fetch directo en el screen (no a través de un contexto/data layer) — disparidad con el patrón de rutas.
- N+1 de red en `stop/[id]` (M5).

---

## 17. Performance

- `ScrollView` + `.map` para listas (rutas, avisos, favoritos, home) — sin virtualización (M6).
- N+1 de red en `stop/[id]` (M5).
- Regresión de memoria de Hermes V1 (M1).
- Mapa en WebView con Leaflet cargado desde CDN (unpkg) + tiles CARTO + routing OSRM público — dependencia de terceros y sin offline (ver Security).
- Sin memoización preventiva; no se reporta como problema salvo lo demostrado (no se exige useMemo/useCallback sin evidencia).
- El render de las listas con datos actuales (volumen bajo) es aceptable; el riesgo crece con el volumen.

---

## 18. Security

- **Tokens**: access + refresh + user en `expo-secure-store` (seguro). ✅
- **Logout no revoca sesión backend** (H2). ⚠️
- **Logging de datos sensibles** en interceptor (M3). ⚠️
- **Fallback ngrok** hardcodeado (M4). ⚠️
- **WebView Leaflet**: `originWhitelist=["*"]`, `mixedContentMode="always"`, `javaScriptEnabled`; el HTML inyecta `stopsJson` (nombre/referencia de paradas) en `<script>var stops = ${stopsJson}</script>` **sin escapar** `</script>`. Si un admin ingresara una parada con `</script>` en el nombre/referencia, rompería el HTML o permitiría inyección de script en el WebView (la app ya confía en el contenido del backend). Dependencias externas en runtime (unpkg, CARTO, OSRM). **Riesgo real pero bajo** (requiere dato malicioso de admin). 
- **Vulnerabilidades npm**: 20 (8 moderate, 12 high) reportadas por `npm audit`. No se aplicó fix.
- **Exposición de errores**: la app muestra mensajes de error de la API en alertas (aceptable).
- **Secretos**: `.env` con `EXPO_PUBLIC_API_URL` (público por diseño, no es secreto). No se detectó ningún secreto hardcodeado en `src/` (los tokens se guardan en SecureStore).

```text
Secret or credential detected: YES (solo EXPO_PUBLIC_API_URL en .env, público por diseño)
Location: .env (no leído) / src/services/api.ts:6 (fallback ngrok)
Value: REDACTED
```

---

## 19. Testing

```text
Unit:       NONE
Component:  NONE
Integration:NONE
E2E:        NONE
Smoke:      NONE
```
No existe ningún test ni framework de test configurado. No hay script de test.

Flujos que merecen protección (P0): auth/OTP/session, contrato de API, navegación protected/public. (No se crean tests en esta fase; propuesta en Phase 2.)

---

## 20. Dependencies

- Todas las versiones coinciden con las esperadas por Expo SDK 57 (según `expo/bundledNativeModules.json`). Sin incompatibilidades. ✅
- Desactualizado: lockfile con parches viejos (expo 57.0.2, RN 0.86.0) → regresión Hermes (M1).
- **CONFIRMED UNUSED**: `@react-navigation/native-stack`, `expo-device`, `expo-system-ui`.
- **Redundantes** (ya provistos por expo-router/expo): `expo-glass-effect`, `@expo/ui`, `expo-constants`, `expo-linking`.
- **Duplicación funcional**: `lucide-react-native` (3 iconos) vs `@expo/vector-icons`.
- **NO eliminar**: `@react-navigation/native`, `react-native-gesture-handler`, `react-native-screens`, `react-native-svg` (peer de lucide), `react-native-worklets` (peer de reanimated), `react-dom`/`react-native-web` (web). Son requeridos transitivamente.

---

## 21. Dead Code / Cleanup Candidates

### SAFE CANDIDATES (cero referencias, eliminar sin riesgo)
- Componentes del starter: `app-tabs.tsx`, `app-tabs.web.tsx`, `animated-icon.tsx`, `animated-icon.web.tsx`, `animated-icon.module.css`, `hint-row.tsx`, `web-badge.tsx`, `collapsible.tsx`, `themed-text.tsx`, `themed-view.tsx`, `external-link.tsx`, `branding/AppLogo.tsx`, `ui/ScreenContainer.tsx`.
- Hooks del starter: `use-theme.ts`, `use-color-scheme.ts`, `use-color-scheme.web.ts`.
- Constantes muertas: `constants/theme.ts` (todo), `constants/storage.ts` (STORAGE_KEYS), `global.css` (solo lo importa theme.ts muerto).
- Archivos vacíos: `types/user.ts`, `types/schedule.ts`, `services/route.service.ts`, `services/notice.service.ts`.
- Types muertos: `RequestCodeDto`, `VerifyCodeDto`, `AuthResponse` (types/auth.ts).
- Scripts: `download-fonts.js`, `scripts/reset-project.js` (+ entrada reset-project en package.json).
- Ruta muerta: `(auth)/welcome.tsx`.
- Pantalla: `(auth)/welcome.tsx`.

### REQUIRES REVIEW
- `constants/theme.ts` + `global.css`: su eliminación **corrige el typecheck FAIL** (son la causa de los 2 errores). Prioridad alta de revisión.
- Dependencias sin uso directo (ver §20) — confirmar uso transitivo antes de remover.
- `expo-image`, `expo-symbols`, `react-native-reanimated`, `expo-web-browser`: solo usados por componentes muertos del starter; si se elimina el starter quedan sin uso.

### DO NOT REMOVE
- `Colors.ts` (tema UPS activo), `AuthContext`, `ThemeContext`, `RoutesContext`, `FavoritesContext`, `FavoriteStopsContext`.
- `LeafletMap.tsx` (activo), `ScreenContainer` (revisar uso — no se usa; pero confirmar antes de borrar).
- Todos los assets USED (logo-ups, logo-busapp, fondo, correo, iconos android/favicon/splash).
- `@react-navigation/native`, gesture-handler, screens, svg, worklets, react-native-web, react-dom (deps transitivas requeridas).

### Assets
```text
USED:             logo-ups.png, logo-busapp.png, fondo.png, correo.png, android-icon-foreground.png, android-icon-monochrome.png, favicon.png, splash-icon.png
POSSIBLY UNUSED:  expo-logo.png, logo-glow.png, expo-badge.png, expo-badge-white.png, tabIcons/home.png, tabIcons/explore.png (solo starter muerto)
CONFIRMED UNUSED: react-logo.png, react-logo@2x.png, react-logo@3x.png, tutorial-web.png, icon.png, android-icon-background.png, tabIcons/home@2x.png, tabIcons/home@3x.png, tabIcons/explore@2x.png, tabIcons/explore@3x.png, expo.icon/icon.json, expo.icon/Assets/*
```

---

## 22. Confirmed Bugs

### CONFIRMED
- H2: logout no revoca la sesión del backend (401 por client.ts sin token).
- H1: contrato de detalle de ruta mal tipado (usa `as any`).
- M8: "Próximo horario" en Home no es el próximo real (muestra schedules[0]).
- Typecheck FAIL por CSS imports del starter muerto.

### POTENTIAL
- Race en `handleChange`/`verifyOtp` de OTP (autoverificación con estado async) — bajo.
- setState tras desmontaje en fetches sin cancelación (avisos/stop/index) — bajo.
- WebView Leaflet: inyección sin escapar de `</script>` si un nombre/referencia de parada lo contiene — requiere dato malicioso (bajo).
- Sesión "autenticada" con token expirado al arrancar (sin refresh/validación en loadSession) — hasta que un request dé 401.

---

## 23. Backend Contract Mismatches

1. **`/mobile/routes/:id`**: app tipa `RouteDetail` plano; backend devuelve `{ route, stops, schedules }`. **MISMATCH** (H1).
2. **`/mobile/routes/:id/stops`**: app `RouteStop.stopId` no existe en backend; `estimatedArrivalMinutes`/`notes` opcionales en backend pero requeridos en app. **PARTIAL**.
3. **`/mobile/notices`**: app `Notice` incluye `isActive`, `createdAt`, `updatedAt` que el backend mobile no devuelve. **PARTIAL**.
4. **`/auth/logout`**: requiere JWT; la app no envía Bearer → 401. **PARTIAL/MISMATCH funcional** (H2).
5. **`Route.description`**: app `string` (requerido); backend `string | null` (opcional). La app ya lo guarda con `!!route.description`. **PARTIAL (menor)**.

---

## 24. What Must NOT Be Changed

- **Almacenamiento de tokens en `expo-secure-store`** (AuthContext) — correcto, no cambiar a AsyncStorage.
- **Flujo de login/OTP/verify y persistencia** — funciona; cambios solo para corregir H2/logout y validación de arranque.
- **`expo-router` + typedRoutes** — correcto; no reemplazar por otra navegación.
- **`Colors.ts` (tema UPS)** — activo y correcto.
- **LeafletMap** en sí (mientras cumpla) — NO rediseñar el mapa; solo revisar seguridad de inyección y dependencias si se decide.
- **Contratos del backend** — no tocar; la corrección va del lado de la app (tipar el servicio, no cambiar el backend).
- **Contextos de favoritos** — funcionan; no reemplazar el patrón por otro state manager sin problema demostrado.
- Las **dependencias transitivas requeridas** (react-navigation/native, gesture-handler, screens, svg, worklets, react-native-web, react-dom) — no remover.

---

## 25. Recommended Phase 2 Scope

### P0 (bloqueantes, antes de cualquier limpieza)
- Restaurar `typecheck`: añadir declaraciones de tipos CSS (`.d.ts`) o eliminar la capa del starter (theme.ts + animated-icon.web.tsx + global.css) que causa los 2 errores.
- Declarar `eslint` + `eslint-config-expo` en devDependencies y versionar `eslint.config.js` (arregla `npm run lint`).
- Corregir el tipo del servicio `getRouteDetail` al shape real `{ route, stops, schedules }` y eliminar los `as any` de map/route/FavoritesContext (H1).
- Corregir logout para enviar Bearer y revocar la sesión backend (H2).

### P1
- Actualizar a expo ≥57.0.9 / RN ≥0.86.2 (arregla regresión Hermes + expo-doctor) — con `npx expo install`.
- Proteger `route/[id]`, `map/[id]`, `stop/[id]` con el guard de auth (H4).
- Unificar el cliente HTTP (un solo axios con interceptores) (M2).
- Corregir "próximo horario" (M8).

### P2
- Quitar código muerto del starter (componentes, hooks, theme.ts, storage.ts, archivos vacíos, scripts, welcome.tsx).
- Quitar deps sin uso (`native-stack`, `expo-device`, `expo-system-ui`) y duplicación `lucide` vs vector-icons.
- Quitar fallback ngrok (M4) y logging de bodies (M3).
- Paginación en cliente (M7).

### P3
- Agregar tests (unit P0 auth/contrato/navegación; luego rutas/avisos/favoritos).
- FlatList para listas (M6), resolver N+1 de stop (M5), revisar WebView/Leaflet y dependencias CDN.

---

## 26. GO / NO-GO

```text
Can we begin cleanup?  CONDITIONAL GO
```
Sí, se puede pasar a una limpieza controlada, PERO con condiciones: la limpieza debe empezar por restaurar la base verificable (typecheck + lint + expo-doctor) y corregir los hallazgos P0 (contrato de ruta, logout, guard de auth, cliente HTTP). No es NO-GO porque la arquitectura activa es coherente y los flujos principales funcionan; no es GO pleno porque la app no compila, no hay tests ni lint reproducibles, y hay una regresión de memoria conocida.

---

## 31. Matriz Final

| Área              | Estado                       |
| ----------------- | ---------------------------- |
| Install           | PASS                         |
| Typecheck         | FAIL                         |
| Lint              | FAIL                         |
| Tests             | NONE                         |
| Expo Doctor       | FAIL (2 checks)              |
| Type Safety       | ACCEPTABLE                   |
| Architecture      | ACCEPTABLE                   |
| API Contract      | PARTIAL (1 MISMATCH)         |
| Auth              | WARN (logout no revoca)      |
| Navigation        | WARN (guard incompleto)      |
| State Management  | ACCEPTABLE                   |
| Performance       | WARN (N+1, ScrollView, Hermes)|
| Security          | WARN (logout, logging, WebView)|
| Dead Code         | HIGH (starter completo muerto)|
| Technical Debt    | MEDIUM-HIGH                  |
| Confirmed Bugs    | 4 (H1, H2, M8, typecheck)    |
| Cleanup readiness | CONDITIONAL GO               |

---

## 32. Checklist de terminación

- [x] baseline Git capturado (mobile no es repo; ups-api main @ c5d46b2)
- [x] package.json revisado
- [x] tsconfig revisado
- [x] app.json revisado
- [x] eas.json revisado
- [x] Expo SDK identificado (57)
- [x] dependencias revisadas
- [x] typecheck ejecutado (FAIL, 2 errores)
- [x] lint ejecutado (FAIL / auto-modifica)
- [x] tests ejecutados o inexistencia confirmada (NONE)
- [x] Expo Doctor ejecutado (FAIL, 2 checks)
- [x] `src/app` auditado
- [x] `src/api` auditado
- [x] `src/services` auditado
- [x] `src/context` auditado
- [x] `src/components` auditado
- [x] `src/types` auditado
- [x] auth auditada
- [x] router auditado
- [x] data fetching auditado
- [x] API comparada contra backend
- [x] seguridad auditada
- [x] performance auditada
- [x] dead code identificado
- [x] assets auditados
- [x] dependencias auditadas
- [x] bugs clasificados
- [x] reporte generado (este archivo)
- [x] SHA final comprobado (N/A mobile; ups-api sin cambios por esta auditoría)
- [x] working tree comprobado
- [x] ningún archivo productivo de `src/` modificado (verificado por mtime)

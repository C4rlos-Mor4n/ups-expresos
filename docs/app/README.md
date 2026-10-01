# App móvil de UPS GO

Aplicación para **estudiantes** (consulta de transporte) y **conductores** (ejecución del servicio asignado).
Código en [`apps/mobile`](../../apps/mobile).

## Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript (`strict`) |
| Framework | React Native 0.86 + Expo SDK 57, React 19 (con React Compiler) |
| Navegación | Expo Router (rutas por archivos, `typedRoutes`) |
| HTTP | Axios con interceptores (token + renovación) |
| Sesión | `expo-secure-store` |
| Contrato con la API | Tipos generados desde OpenAPI (`src/api/generated/openapi.ts`) + validación en tiempo de ejecución |
| Pruebas | Jest + `jest-expo` + `react-test-renderer` |
| Calidad | ESLint (`eslint-config-expo`), `tsc --noEmit` |
| Gestor de paquetes | npm |
| Build / distribución | EAS Build (Android APK `preview`, AAB `production`); desarrollo con dev-client |

Identificadores: Android `ec.edu.ups.expresos`, iOS `ec.edu.ups.expresos`, esquema `upsgo`.

## Puesta en marcha

```bash
cd apps/mobile
cp .env.example .env          # define EXPO_PUBLIC_API_URL (URL absoluta http/https de la API)
npm ci
npm run verify                # lint + typecheck + tests
npx expo start                # requiere dev-client o build nativo (el proyecto usa expo-dev-client)
```

`EXPO_PUBLIC_API_URL` es obligatoria: sin una URL `http(s)` absoluta la app falla al iniciar con un mensaje claro
(no hay fallback inseguro). En emulador Android la API local se alcanza con `adb reverse tcp:3000 tcp:3000`
(lo automatiza [`scripts/dev-stack.sh`](../../scripts/dev-stack.sh)).

Flujo de desarrollo completo (emulador + API + Metro): `./scripts/dev-stack.sh` (detalles en
[`build-and-release.md`](./build-and-release.md)).

## Qué hace cada rol

| Rol | Experiencia |
|---|---|
| `STUDENT` | Inicio → Campus → Línea → Salida → asignación por bus y paradas (hora programada). Preferencia de campus por usuario. |
| `DRIVER` | Inicio → Mis servicios → Detalle de asignación → Iniciar → Recorrido actual → Finalizar. |
| `ADMIN` / `SUPER_ADMIN` | Sin flujo móvil: ven "rol no soportado". La administración será web. |

La app resuelve el rol del usuario autenticado; no existe selector manual de rol. El backend sigue siendo la autoridad
de autorización en cada endpoint.

## Qué NO hace (todavía)

GPS en tiempo real, mapa, ETA, notificaciones push. Todo horario mostrado es **programado**
(`hora de salida + offsetMinutes`); nunca se simula una posición ni una estimación.

## Documentos relacionados

- [`architecture.md`](./architecture.md) — estructura, sesión, red, contrato y navegación.
- [`build-and-release.md`](./build-and-release.md) — dev-client, EAS, proyecto Expo, publicación.
- [`conventions.md`](./conventions.md) — reglas para contribuir.
- [`product.md`](./product.md) y [`design-system.md`](./design-system.md) — producto y sistema visual.

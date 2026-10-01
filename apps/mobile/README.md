# UPS GO Mobile

App Expo / React Native para estudiantes y conductores de UPS GO. Documentación completa en
[`docs/app`](../../docs/app/README.md); esta es la guía rápida.

## Requisitos

- Node.js 20, npm
- Un backend accesible (ver `EXPO_PUBLIC_API_URL`)
- Android Studio / emulador, o un teléfono con el dev-client o un APK de EAS

## Inicio rápido

```bash
cp .env.example .env     # EXPO_PUBLIC_API_URL=<URL absoluta http(s) de la API>
npm ci
npm run verify           # eslint + tsc + jest
npx expo start           # el proyecto usa expo-dev-client
```

Stack completo en emulador (BD + API + Metro + app): `../../scripts/dev-stack.sh`.

## Variables

| Variable | Descripción |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL base de la API. Obligatoria: sin una URL `http(s)` absoluta la app falla al iniciar. Se incrusta en el bundle. |

## Build para probar en un teléfono

```bash
eas build --platform android --profile preview   # genera un APK instalable
```

La API debe estar desplegada con HTTPS y `EXPO_PUBLIC_API_URL` definida para el perfil. Guía:
[`docs/app/build-and-release.md`](../../docs/app/build-and-release.md).

## Reglas esenciales

- TypeScript estricto sin `any`; sin warnings de ESLint.
- `src/api/generated/openapi.ts` se genera desde la API; no se edita.
- Sesión solo en SecureStore; nada de GPS/ETA simulados.
- Antes de un PR: `npm run verify` y `npx expo export -p android --no-bytecode`.

Antes de escribir código Expo, consulta [`AGENTS.md`](./AGENTS.md) (documentación de la versión instalada).

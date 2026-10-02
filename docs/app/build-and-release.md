# Build, entornos y publicación de la app

## Entornos de ejecución

| Entorno | Cómo se obtiene | `EXPO_PUBLIC_API_URL` |
|---|---|---|
| Desarrollo local | `./scripts/dev-stack.sh` (emulador Android + API + Metro + dev-client) | `http://localhost:3000` vía `adb reverse` |
| Build interna (APK) | EAS Build, perfil `preview` | URL pública HTTPS de la API |
| Producción (tienda) | EAS Build, perfil `production` (AAB) | URL pública HTTPS de la API |

`EXPO_PUBLIC_*` se incrusta en el bundle durante el build: **un APK compilado apuntando a `localhost` no funciona en un
teléfono**. Siempre se compila con la URL pública de la API ya desplegada.

## Desarrollo local con `dev-stack.sh`

```bash
./scripts/dev-stack.sh            # levanta BD, emulador, API, Metro e instala/lanza la app
./scripts/dev-stack.sh --rebuild  # regenera Android y recompila (tras cambios nativos o de dependencias)
./scripts/dev-stack.sh --status
./scripts/dev-stack.sh --stop     # detiene solo API y Metro de este checkout
```

Pensado para WSL + emulador Android en Windows; las rutas del SDK se detectan o se indican con
`ANDROID_SDK_WINDOWS` / `ANDROID_SDK_ROOT`. El código nativo (`android/`, `ios/`) se genera y no se versiona.

## Proyecto Expo / EAS

`app.json → expo.extra.eas.projectId` identifica el proyecto de EAS. Para usar **otro proyecto o cuenta de Expo**:

```bash
cd apps/mobile
npm i -g eas-cli
eas login
eas init            # crea el proyecto en la cuenta activa y actualiza extra.eas.projectId en app.json
```

Si el `projectId` actual pertenece a una cuenta a la que no tienes acceso, `eas init` (o editar `projectId` por el del
proyecto nuevo) es el paso para migrar. Commitea el cambio de `app.json`.

> Crear un proyecto de Expo requiere autenticación de la cuenta propietaria (`eas login` o un `EXPO_TOKEN`); no puede
> hacerse sin credenciales. Vincular el repositorio de GitHub al proyecto (panel de Expo) permite lanzar builds desde la nube.

## Variables de entorno de la build

Define la URL de la API como variable de EAS del perfil (no en el repositorio):

```bash
eas env:create --environment preview    --name EXPO_PUBLIC_API_URL --value https://api.tu-dominio.com --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.tu-dominio.com --visibility plaintext
```

`eas.json` define los perfiles `preview` (APK, distribución interna) y `production` (AAB). Asocia cada perfil a su entorno
con `"environment": "preview"` / `"production"` dentro del perfil si usas variables de EAS.

## Build interna para probar en un teléfono

```bash
cd apps/mobile
eas build --platform android --profile preview
```

EAS entrega un enlace de descarga del APK (y un QR). Instálalo en el teléfono Android (permitir orígenes desconocidos).
Requisitos previos: API desplegada con HTTPS y SMTP funcional (los inicios de sesión usan OTP por correo).
iOS requiere cuenta de Apple Developer y no se ha validado en dispositivo.

## Versionado de builds

- **`versionCode` (Android) / `buildNumber` (iOS)**: los gestiona EAS (`"appVersionSource": "remote"` en `eas.json`) y
  cada build de `preview` y `production` lo incrementa solo (`"autoIncrement": true`). No se escriben en `app.json`.
  Esto evita que Android rechace un APK nuevo por traer el mismo número que el instalado.
- Consultar / corregir el valor remoto: `eas build:version:get -p android` y `eas build:version:set -p android`.
  Se inicializó en `1` (el de los APK ya distribuidos); el siguiente build sale con `2`.
- **`expo.version`** (la versión visible, p. ej. `1.0.1`) sigue siendo manual y se sube solo en releases con cambios
  nativos. Cambiarla altera el `runtimeVersion` (fingerprint), así que obliga a distribuir un APK nuevo: los APK
  anteriores dejan de recibir actualizaciones OTA.

## Antes de publicar una versión

- [ ] `npm run verify` y `npx expo export -p android --no-bytecode` en verde.
- [ ] Contrato sincronizado (`pnpm verify:mobile-contracts` en `apps/api`).
- [ ] Si hay cambios nativos: `expo.version` actualizado en `app.json` y `package.json` (el `versionCode` es automático).
- [ ] QA manual en dispositivo (Student y Driver), con la API de destino.
- [ ] `EXPO_PUBLIC_API_URL` del perfil apunta al entorno correcto.

## Deuda de plataforma conocida

Alinear Expo SDK y React Native con los parches recomendados por `npx expo-doctor` y revisar la advertencia de Hermes V1;
no mezclarlo con una funcionalidad. QA nativo en iOS pendiente.

## Build de pruebas y actualizaciones OTA (sin tiendas)

Mientras la app no esté en Play Store / App Store, los testers reciben las mejoras por **EAS Update (OTA)**:
se publica solo el JavaScript y los assets, y la app instalada los descarga sola. No hay que reenviar el APK.

Piezas (todas en `apps/mobile`):
- `expo-updates` + `updates.url` y `runtimeVersion` (política `fingerprint`) en `app.json`.
- Canal `preview` en el perfil `preview` de `eas.json` (y `production` para el futuro).
- `src/components/update-prompt.tsx`: busca actualización al abrir la app y al volver a primer plano, la
  descarga y pregunta "Reiniciar ahora / Más tarde".
- La URL de la API (`EXPO_PUBLIC_API_URL`) vive como **variable de entorno de EAS** (entorno `preview`), no en
  el repositorio. Para cambiarla: `eas env:update` / `eas env:create --environment preview` y volver a publicar.

### Flujo diario

```sh
cd apps/mobile
npm run update:preview -- "descripción del cambio"     # = eas update --channel preview --environment preview
```
Los testers lo reciben al abrir la app (o al volver a ella) y confirman el reinicio.

### Cuándo SÍ hace falta un APK nuevo
`runtimeVersion` (fingerprint) cambia cuando cambia algo nativo: dependencias nativas nuevas o actualizadas,
plugins/permisos o ajustes nativos de `app.json`, iconos, splash, versión de Expo SDK. Una actualización OTA
solo la reciben los APK con el mismo `runtimeVersion`; los demás la ignoran sin romperse. En ese caso:

```sh
npx eas-cli build -p android --profile preview      # enlace nuevo de instalación para los testers
```

### Primer build / proyecto nuevo
```sh
npx eas-cli login          # cuenta Expo dueña del proyecto (o EXPO_TOKEN en CI)
npx eas-cli build -p android --profile preview
```
El proyecto actual es `@c4rlosmor4n/ups-go` (ID en `app.json → extra.eas.projectId`).

### Rollback
`eas update:rollback` o republicar el commit bueno con `npm run update:preview`.

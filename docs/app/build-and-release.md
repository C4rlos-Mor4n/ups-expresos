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

## Antes de publicar una versión

- [ ] `npm run verify` y `npx expo export -p android --no-bytecode` en verde.
- [ ] Contrato sincronizado (`pnpm verify:mobile-contracts` en `apps/api`).
- [ ] Versión actualizada en `app.json` (`expo.version`) y `package.json`.
- [ ] QA manual en dispositivo (Student y Driver), con la API de destino.
- [ ] `EXPO_PUBLIC_API_URL` del perfil apunta al entorno correcto.

## Deuda de plataforma conocida

Alinear Expo SDK y React Native con los parches recomendados por `npx expo-doctor` y revisar la advertencia de Hermes V1;
no mezclarlo con una funcionalidad. QA nativo en iOS pendiente.

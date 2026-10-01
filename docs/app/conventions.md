# Convenciones y reglas de contribución (app móvil)

## Flujo de trabajo

Igual que la API: rama por cambio, commits pequeños con prefijo convencional (`feat(mobile):`, `fix(mobile):`, …), PR con CI
en verde. Antes de abrirlo:

```bash
cd apps/mobile
npm run verify                              # eslint + tsc + jest
npx expo export -p android --no-bytecode    # compila el bundle
```

## Código

- TypeScript `strict`. Prohibido `any` (regla ESLint como error). Usa los tipos de `generated/openapi.ts` o tipos propios en `src/types`.
- Los warnings de ESLint se corrigen; el proyecto debe quedar sin advertencias.
- Imports con el alias `@/…` para rutas dentro de `src`.
- Lógica sin UI en `services/` y `utils/` con pruebas; las pantallas solo componen y llaman a servicios.
- Todo dato de la API pasa por el validador de contrato antes de pintarse.
- Sin código muerto ni assets sin uso. Un asset nuevo se referencia desde código o `app.json`.
- Sin `console.log` en código de producción. Nunca registres tokens, OTP ni datos personales.
- Ajusta estilos y espaciados con el sistema de [`design-system.md`](./design-system.md): estados con texto **e** icono, no solo color;
  objetivos táctiles ≥ 44 px; esqueletos de carga, estados vacíos y errores con acción de recuperación.

## Seguridad y datos

- Tokens y datos de sesión solo en `expo-secure-store`.
- No se guarda información operativa sensible en el dispositivo (la preferencia de campus es solo UX).
- No añadas secretos al bundle: `EXPO_PUBLIC_*` es público por definición.
- No mostrar licencia, teléfono ni datos internos del conductor al estudiante.

## Contrato y compatibilidad

- No edites `src/api/generated/openapi.ts`; se regenera desde la API.
- Si la API cambia un campo que consumes, actualiza el servicio, el validador y las pruebas en el mismo PR.
- No simules GPS, ETA ni estados: muestra solo lo que el backend entrega.

## Dependencias

- Usa `npx expo install <paquete>` para módulos nativos (versión compatible con el SDK).
- No ejecutes `npm audit fix --force`. Las actualizaciones de Expo/React Native se hacen como un cambio aislado.
- Verifica con `npx expo-doctor` tras cambios de dependencias.

## Documentación del cambio

Si cambia un flujo o una regla de presentación, actualiza `docs/app` en el mismo PR.

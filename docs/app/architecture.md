# Arquitectura de la app móvil

## Estructura

```text
apps/mobile/
  app.json            configuración Expo (identificadores, plugins, EAS projectId)
  eas.json            perfiles de build (preview APK, production AAB)
  assets/             iconos, splash e imágenes (todas referenciadas por código o app.json)
  src/
    app/              rutas (Expo Router)
      _layout.tsx       proveedor de sesión + guard de navegación por rol
      index.tsx         pantalla de bienvenida
      (auth)/           login y verificación OTP
      (student)/        pestañas Inicio / Servicios / Perfil; selección de campus, línea y detalle de salida
      (driver)/         pestañas Inicio / Servicios / Perfil; detalle de asignación y recorrido
      unsupported-role.tsx
    api/
      client.ts         instancia Axios, interceptores, renovación de sesión
      session-keys.ts   claves de SecureStore
      generated/openapi.ts   tipos generados desde la API (no editar)
    context/AuthContext.tsx  estado de sesión
    services/         auth, operación (Student/Driver), preferencias de campus y de estudiante, validación de contrato
    components/       UI compartida (operational-ui), UI del estudiante (student-ui), logo, perfil, aviso de actualización
    hooks/            use-guayaquil-clock (reloj que refresca los "en X min")
    constants/Colors.ts, types/, utils/ (operational, schedule)
```

Alias de importación: `@/*` → `src/*`.

## Sesión

- Tokens y usuario en `expo-secure-store` (`access_token`, `refresh_token`, `user`); nunca en almacenamiento no cifrado.
- El interceptor añade `Authorization: Bearer <access>`. Ante un 401 intenta **un único** refresh compartido entre
  solicitudes concurrentes; si rota, actualiza SecureStore y el estado React (`onTokensRotated`); si falla, limpia la
  sesión (`onSessionExpired`) y el guard redirige a login.
- `logout` revoca la sesión en el backend (best-effort) y limpia siempre el almacenamiento local.
- El guard de `_layout.tsx` impide abrir el espacio de otro rol mediante deep links (`canAccessRoleRoute`); es una
  comodidad visual, no seguridad: el backend autoriza cada endpoint.

## Contrato con la API

```text
DTOs NestJS → OpenAPI → openapi-typescript → src/api/generated/openapi.ts
                                                  ↓
                          services/operational-contract.ts  (validación en ejecución)
                                                  ↓
                          services/*.service.ts → pantallas
```

- Cada respuesta se valida y normaliza en `operational-contract.ts` antes de llegar a la UI.
- **Nunca** se edita `generated/openapi.ts`: se regenera desde `apps/api` con `pnpm generate:mobile-contracts`
  y se verifica con `pnpm verify:mobile-contracts`.

## Reglas de presentación del dominio

- Estados visibles: `Programado`, `Asignado`, `En recorrido`, `Finalizado` (los define el backend).
- Salida sin asignaciones y con más de un recorrido posible: se muestra "Recorrido por confirmar"; no se elige el primero.
- Con varios buses cada uno muestra su propio recorrido.
- Vehículo: código, placa y capacidad ("X pasajeros"). Conductor: solo el nombre que entrega el contrato; nunca licencia ni teléfono.
- Las horas de parada son programadas (`salida + offsetMinutes`), nunca ETA.
- La preferencia de campus es **UX, no autorización**; se guarda en SecureStore con clave por usuario
  (`ups_go.preferred_campus_id.<userId>`).
- Preferencias del estudiante (`student-preferences.service.ts`, clave `ups_go.student_prefs.<userId>`): líneas
  favoritas, parada elegida por línea y sentido, y si descartó el aviso de nombre. Solo locales, nunca autorización.

## Experiencia del estudiante (Fase 1–2 de UX)

- **Inicio = "Tu próximo bus"**: tarjeta principal con cuánto falta ("en 12 min"), hora, línea, origen → destino
  y, si eligió parada, a qué hora pasa por ella. Debajo, "Más tarde hoy" (solo salidas futuras) y "Tus líneas".
  El sentido (Ida/Retorno) se elige solo según el próximo bus y se puede cambiar.
- Si hoy ya no quedan salidas en ese sentido, el inicio busca la siguiente en los próximos 7 días.
- Con líneas favoritas (★), el inicio considera solo esas; sin favoritas, todas las del campus.
- **"¿Dónde lo tomas?"** (pantalla de línea): el estudiante elige su parada y todas las horas pasan a ser la hora
  de paso por esa parada (`stopTimes` del listado de salidas). Las salidas pasadas se pliegan.
- El estado se muestra solo si no es `Programado` (es el estado por defecto y no aporta).
- El saludo usa el nombre guardado (`PATCH /auth/me`); nunca la parte del correo.
- Tiempos relativos y "pasadas/próximas" se calculan con la hora de Guayaquil (`utils/schedule.ts`).

## Red

- Timeout de 10 s. Los errores se traducen a mensajes para el usuario en `utils/error-message.ts`
  (sin exponer detalles técnicos).
- Conectividad inestable: el estado de sesión se conserva y nunca se inventan datos de horarios u operación.

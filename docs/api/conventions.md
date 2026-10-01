# Convenciones y reglas de contribución (API)

## Flujo de trabajo

1. Trabaja siempre en una rama (`feat/...`, `fix/...`, `chore/...`); nunca directo en `main`.
2. Cambios pequeños y auditables; no mezcles refactors no relacionados con una funcionalidad.
3. Commits en imperativo con prefijo convencional: `feat(api):`, `fix(auth):`, `chore:`, `test:`, `docs:`.
4. Todo cambio pasa los gates (abajo) y el CI antes de integrarse mediante PR. No se hace `force push` sobre ramas compartidas.
5. No se suben `.env`, volcados de base de datos, tokens ni credenciales.

## Gates obligatorios (desde `apps/api`)

```bash
pnpm prisma:validate && pnpm lint && pnpm typecheck && pnpm build
pnpm exec jest --runInBand
pnpm test:openapi && pnpm verify:mobile-contracts      # requieren las variables de entorno mínimas (ver testing.md)
```

Los cambios que tocan la base de datos o el flujo de autenticación además ejecutan las integraciones y el E2E sobre
PostgreSQL aislado ([`testing.md`](./testing.md)).

## Código

- TypeScript estricto. **Prohibido** `any` (regla ESLint como error), `@ts-ignore` y `as unknown as`. Si necesitas un tipo, defínelo.
- Variables no usadas: error (prefijo `_` solo para parámetros intencionalmente ignorados).
- Todo input externo se valida con DTO (`class-validator`). Todo DTO de respuesta se declara con `@ApiProperty` para que OpenAPI sea exacto.
- Lógica de negocio en servicios y funciones puras testeables (`*.functions.ts`); los controladores solo orquestan y autorizan.
- Cada ruta declara `@Roles(...)` o `@Public()` de forma explícita. Una ruta nueva sin protección es un defecto.
- Datos multi-rol: el rol y la propiedad se verifican en el servidor (p. ej. el conductor se identifica por el JWT, nunca por un `driverId` enviado).
- No dejes código muerto: si algo no se usa y no está planificado, se elimina. Las rutas Admin sin consumidor actual **sí se conservan** (base del panel web).
- Comentarios: explican el *porqué*, no el *qué*.
- Sin logs de OTP, tokens, correos de destinatarios ni secretos.

## Base de datos

- Solo migraciones (`pnpm prisma:migrate`); nunca `db push` en entornos compartidos.
- No edites, renombres ni borres migraciones ya aplicadas. Los cambios se hacen con migraciones nuevas.
- Toda migración se prueba **desde cero** y **sobre datos existentes**, y se revisa: nullabilidad, índices, constraints, bloqueos y rollback.
- Preferir desactivar/archivar sobre borrar entidades con historia operativa.
- Los constraints de solape de asignaciones y las unicidades son parte del contrato; no se retiran.

## Contratos

- DTOs → OpenAPI → `apps/mobile/src/api/generated/openapi.ts`. Tras tocar DTOs o anotaciones:
  `pnpm generate:mobile-contracts` y commitea el resultado. **No edites el archivo generado a mano.**
- Los cambios de contrato son aditivos. Eliminar o renombrar algo que la app consume requiere advertencia, transición y rollback.

## Reglas de dominio que no se rompen

- Calendario `PUBLISHED` siempre completo (puerta de publicación). `offsetMinutes` es la única fuente de tiempos de parada.
- Materialización idempotente por `sourceScheduleTimeId + serviceDate`.
- Una salida admite 0..N asignaciones; asignación ≠ ejecución; el conductor inicia el `ServiceRun` explícitamente.
- No se infiere `IN_PROGRESS` por GPS. No se muestra ETA inventada.
- No se vuelve a crear `AllowedEmailDomain`: los dominios son configuración (`ALLOWED_EMAIL_DOMAINS`).
- No hay login por contraseña: solo OTP.

## Seguridad

- Variables sensibles solo por entorno; `.env.example` con placeholders.
- No bajar controles (rate limiting, validación, roles) para hacer pasar una prueba.
- Todo webhook server-to-server (p. ej. Hunter) usa su propia autenticación, no JWT de usuarios.
- Dependencias: no ejecutar `npm audit fix --force` sin revisión; subir versiones de forma deliberada.

## Límite conocido

El rol viaja en el access token (15 min por defecto): un cambio de rol o desactivación se refleja por completo al
expirar el token. La desactivación sí se verifica en cada solicitud (`JwtStrategy`). Si se requiere revocación inmediata
de rol, hay que revalidarlo en cada solicitud.

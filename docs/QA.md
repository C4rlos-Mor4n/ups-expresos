# UPS GO — QA local

Esta guía reúne los gates reproducibles del API y de Mobile. No contiene
secretos y no sustituye la revisión de despliegue ni el QA manual del usuario.

## API

Desde `apps/api`:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm prisma:validate
pnpm exec jest --runInBand
pnpm test:openapi
pnpm verify:mobile-contracts
```

Las pruebas PostgreSQL usan una base aislada y descartable. Para activar las
integraciones, se habilita únicamente el flag correspondiente:

```bash
RUN_CALENDAR_INTEGRATION=true pnpm test:calendar:integration
RUN_SCHEDULED_DEPARTURE_INTEGRATION=true pnpm test:scheduled-departure:integration
RUN_SCHEDULED_DEPARTURE_MATERIALIZER_INTEGRATION=true pnpm test:scheduled-departure-materializer:integration
RUN_PHASE_6_OPERATIONAL_INTEGRATION=true pnpm test:phase6:operational-integration
RUN_PHASE_6_API_INTEGRATION=true pnpm test:phase6:api-integration
RUN_REFERENCE_INTEGRATION=true pnpm exec jest src/modules/operational/campus-service-lines.integration.spec.ts --runInBand
RUN_GOLDEN_INTEGRATION=true pnpm exec jest src/modules/operational/departure-detail-golden.integration.spec.ts --runInBand
```

E2E debe ejecutarse con una base PostgreSQL de test dedicada y descartable.
El comando `test:e2e` contiene un endpoint local por defecto; para cualquier
otra instancia, exporta explícitamente todas las variables de test y aplica
las migraciones antes de ejecutar Jest:

```bash
export DATABASE_URL='postgresql://<test-user>:<test-password>@127.0.0.1:<test-port>/<test-database>?schema=public'
export NODE_ENV=test
export JWT_ACCESS_SECRET='local-e2e-access-secret'
export JWT_REFRESH_SECRET='local-e2e-refresh-secret'
export AUTH_DEV_EXPOSE_OTP=true
export ALLOWED_EMAIL_DOMAINS='ups.edu.ec,est.ups.edu.ec'
export SWAGGER_ENABLED=false
pnpm prisma migrate deploy
pnpm exec jest --config ./test/jest-e2e.json
```

## Datos de referencia y showcase

`pnpm prisma:seed:reference` carga el dataset aprobado de
`docs/ups_go_routes_reference_guayaquil.json` en una base local aislada.

`pnpm prisma:seed:demo` y `pnpm prisma:reset:demo` solo operan sobre datos
marcados `UPS-GO-DEMO`; el reset exige confirmación y se bloquea en producción.

`pnpm qa:showcase:reset` exige `CONFIRM_LOCAL_QA_RESET=YES`, rechaza producción
y debe apuntar exclusivamente a una base local descartable.

No uses la base de showcase para pruebas de integración ni para E2E. Las
pruebas deben usar PostgreSQL de test separado y nunca modificar la base real.

## Mobile

Desde `apps/mobile`:

```bash
npm run verify
npx expo export -p android --no-bytecode
```

`EXPO_PUBLIC_API_URL` se configura en el entorno local. El QA visual o de
dispositivo es un gate separado y queda bajo control del propietario del
emulador o teléfono.

# Configuración de la API

La API valida el entorno al iniciar con un esquema `zod`
([`src/config/env.schema.ts`](../../apps/api/src/config/env.schema.ts)). Si falta una variable
obligatoria o una regla de producción no se cumple, **el proceso no arranca**.

Plantillas: [`apps/api/.env.example`](../../apps/api/.env.example) (desarrollo) y
[`.env.example`](../../.env.example) en la raíz (despliegue con Docker Compose).

## Variables

| Variable | Obligatoria | Default | Descripción |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development`, `production` o `test`. Activa las reglas de producción. |
| `PORT` | No | `3000` | Puerto HTTP. |
| `APP_NAME` | No | `UPS GO API` | Nombre de la aplicación. |
| `DATABASE_URL` | **Sí** | — | URL de PostgreSQL (`...?schema=public`). |
| `JWT_ACCESS_SECRET` | **Sí** | — | Secreto del access token. |
| `JWT_REFRESH_SECRET` | **Sí** | — | Secreto del refresh token. Distinto del anterior. |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Vigencia del access token. |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Vigencia del refresh token. |
| `OTP_EXPIRES_MINUTES` | No | `10` | Vigencia del código OTP. |
| `OTP_MAX_ATTEMPTS` | No | `5` | Intentos permitidos por código. |
| `AUTH_DEV_EXPOSE_OTP` | No | `false` | Devuelve el OTP en `request-code`. **Prohibido en producción.** |
| `ALLOWED_EMAIL_DOMAINS` | **Sí** | — | Dominios que pueden auto-registrarse como `STUDENT` (coma). Fuente de verdad. |
| `SUPER_ADMIN_EMAILS` | No | vacío | Correos que reciben `SUPER_ADMIN` al iniciar sesión y con `prisma:seed`. |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Orígenes de navegador permitidos (coma). La app móvil no usa CORS. |
| `TRUST_PROXY_HOPS` | No | `0` | Saltos de proxy confiables para identificar la IP del cliente. Con un reverse proxy: `1`. |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | No | `60000` / `60` | Ventana (ms) y límite global de rate limiting. |
| `SWAGGER_ENABLED` | No | `false` | Publica Swagger UI. |
| `SWAGGER_PATH` | No | `docs` | Ruta de Swagger UI. |
| `APP_PUBLIC_URL` | No | — | URL pública (solo para el selector de servidor de Swagger). Vacío = sin definir. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Solo en producción | — | Envío de OTP. Con host, usuario y contraseña definidos se usa SMTP; si no, el proveedor de desarrollo no envía correo. |

## Reglas que se validan en producción

Con `NODE_ENV=production` el arranque falla si:

- `AUTH_DEV_EXPOSE_OTP=true`.
- `JWT_ACCESS_SECRET` o `JWT_REFRESH_SECRET` empiezan con `change-me`.
- Falta `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` o `SMTP_FROM`.

## Variables solo para QA / pruebas

No forman parte de la configuración de la aplicación:

| Variable | Uso |
|---|---|
| `API_ENV_FILE` | Ruta de un `.env` alternativo (E2E). |
| `CONFIRM_LOCAL_QA_RESET=YES` | Habilita `pnpm qa:showcase:reset`. |
| `UPS_GO_DEMO_MODE`, `UPS_GO_DEMO_CONFIRM` | Controlan el borrado del dataset demo. |
| `RUN_*_INTEGRATION` | Activan cada suite de integración (ver [`testing.md`](./testing.md)). |

## Secretos

- Genera secretos con `openssl rand -base64 48`.
- Nunca imprimas `.env` ni valores reales en logs, issues o commits.
- En Dokploy define las variables en el panel del servicio; no las guardes en el repositorio.

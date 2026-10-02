# Despliegue de la API

La API se despliega como contenedor Docker junto con PostgreSQL. Los archivos están en la raíz del repositorio:

| Archivo | Función |
|---|---|
| [`apps/api/Dockerfile`](../../apps/api/Dockerfile) | Imagen multi-etapa (Node 20, OpenSSL para Prisma, pnpm 10.34.5). Corre como usuario no root con `HEALTHCHECK` sobre `/health`. |
| [`docker-compose.yml`](../../docker-compose.yml) | Servicios `postgres`, `migrate` (aplica migraciones y termina) y `api`. |
| [`docker-compose.local.yml`](../../docker-compose.local.yml) | Override opcional que publica el puerto de la API en el host (pruebas sin reverse proxy). |
| [`.env.example`](../../.env.example) | Variables que consume el compose. |

La imagen conserva todas las dependencias (incluida la CLI de Prisma) para poder ejecutar migraciones y seeds
desde el mismo artefacto. Es más grande que una imagen mínima, pero evita desajustes entre migrar y servir.

## Pasos (servidor propio o Dokploy)

1. Clona el repositorio en el servidor.
2. `cp .env.example .env` y reemplaza **todos** los placeholders: contraseña de base de datos, secretos JWT
   (`openssl rand -base64 48`), SMTP real, `ALLOWED_EMAIL_DOMAINS`, `SUPER_ADMIN_EMAILS`.
3. `docker compose up -d --build`.
4. `docker compose logs -f migrate api` hasta ver la API escuchando. `migrate` debe terminar con código 0.
5. Verifica `GET https://<tu-dominio>/health` y `/health/db`.
6. Crea los administradores iniciales (opcional si inician sesión con `SUPER_ADMIN_EMAILS`):
   `docker compose exec api node_modules/.bin/tsx prisma/seed.ts`.

El compose **no publica puertos**: la API queda en el puerto interno `3000` y se expone con el reverse proxy.
Con Dokploy, crea la aplicación de tipo *Compose*, apunta al repositorio, define las variables en su panel y asigna el
dominio al servicio `api` con el puerto `3000` (HTTPS lo gestiona Traefik). Mantén `TRUST_PROXY_HOPS=1`.

Para una prueba local sin proxy:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build   # http://localhost:3000
```

## Después de desplegar

1. Define `CORS_ORIGINS` solo si habrá un cliente web; la app móvil no necesita CORS.
2. En la app móvil, apunta `EXPO_PUBLIC_API_URL` al dominio HTTPS (ver [`../app/build-and-release.md`](../app/build-and-release.md)).
3. Carga datos: no hay datos de transporte por defecto. Para un entorno de pruebas puedes cargar la referencia de
   Guayaquil desde una máquina con acceso a la base (ver *Datos* abajo). En producción, los datos se administran
   mediante la API de Admin.

## Datos de prueba (solo entornos descartables)

El dataset de referencia (`apps/api/prisma/data/ups_go_routes_reference_guayaquil.json`) viaja dentro de la imagen
(carpeta `prisma/`), igual que los scripts compilados (`dist/scripts/`). En el contenedor `api` (Dokploy → servicio →
Advanced → Terminal, shell `sh`):

```sh
# Super admins (SUPER_ADMIN_EMAILS). Idempotente.
node_modules/.bin/tsx prisma/seed.ts

# Campus, líneas, paradas, horarios y salidas materializadas. Idempotente.
# Por defecto: hoy (hora Guayaquil) + 14 días; ajusta con --from / --to.
node dist/scripts/seed-from-reference.js
node dist/scripts/seed-from-reference.js --from=2026-10-02 --to=2026-11-30
```

Repite el comando de referencia cuando la ventana de salidas se agote (las salidas se materializan por fecha).
Desde un checkout local: `cd apps/api && pnpm prisma:seed:reference`.

`pnpm qa:showcase:reset` es **destructivo**: borra y recrea datos. Solo con `CONFIRM_LOCAL_QA_RESET=YES`, en una base
local descartable, nunca en producción.

## Migraciones

- Se aplican automáticamente en cada `docker compose up` mediante el servicio `migrate` (`prisma migrate deploy`, idempotente).
- Nunca se usa `prisma db push` en entornos compartidos.
- Antes de una migración que altere datos, respalda la base.

## Respaldo y restauración

```bash
# Respaldo
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup-$(date +%F).sql
# Restauración (base vacía)
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < backup-YYYY-MM-DD.sql
```

Programa los respaldos fuera del contenedor (cron del servidor o la función de backups de Dokploy) y guarda copias fuera del servidor.

## Observabilidad y operación

- Salud: `GET /health` (proceso) y `GET /health/db` (conexión a PostgreSQL). El `HEALTHCHECK` de la imagen usa `/health`.
- Logs: `docker compose logs -f api`. La API no registra OTP, tokens ni credenciales SMTP.
- Actualizar: `git pull && docker compose up -d --build`.
- Reiniciar: `docker compose restart api`.

## Lista de verificación antes de abrir a usuarios

- [ ] `.env` con secretos únicos (ninguno empieza con `change-me`) y SMTP probado (llega el OTP).
- [ ] Dominio con HTTPS y `TRUST_PROXY_HOPS=1`.
- [ ] `AUTH_DEV_EXPOSE_OTP=false` (el compose lo fija así) y Swagger apagado o protegido.
- [ ] Respaldo programado y restauración probada.
- [ ] La app compilada apunta al dominio correcto.

## Entorno de pruebas sin dominio (ngrok)

Para probar sin comprar dominio ni configurar SMTP, el `docker-compose.yml` incluye un servicio `ngrok`
bajo el perfil `tunnel` que apunta directo a `api:3000` (sin pasar por Traefik). Variables de entorno
en Dokploy (nunca en el repositorio):

```
COMPOSE_PROFILES=tunnel
NGROK_AUTHTOKEN=<secreto>
NGROK_URL=https://<dominio-estatico>.ngrok-free.app
APP_ENV=development          # permite AUTH_DEV_EXPOSE_OTP
AUTH_DEV_EXPOSE_OTP=true     # el OTP vuelve en la respuesta de /auth/request-code
SWAGGER_ENABLED=true
APP_PUBLIC_URL=<NGROK_URL>
```

Notas:
- **Solo pruebas.** En producción `APP_ENV=production`, `AUTH_DEV_EXPOSE_OTP=false`, SMTP completo y dominio propio.
- ngrok gratuito muestra una página intermedia a los navegadores; los clientes de API (la app) no la ven. En
  `curl`/Postman añade la cabecera `ngrok-skip-browser-warning: 1`.
- El authtoken de ngrok se debe rotar si se ha compartido fuera de Dokploy.

# UPS ExpresosApp API

Backend API para el sistema de gestión de transporte institucional de la Universidad Politécnica Salesiana. Esta API sirve como backend centralizado para la aplicación móvil (Expo) y la web administrativa (React).

## 📋 Descripción del Proyecto

UPS ExpresosApp es una solución institucional que permite a los estudiantes de la UPS acceder a información sobre rutas de transporte, paradas, horarios y avisos en tiempo real. El sistema incluye:

- **App Móvil (Expo)**: Para que estudiantes consulten rutas, paradas, horarios y califiquen el servicio
- **Web Administrativa (React)**: Para que administradores gestionen rutas, paradas, horarios, vehículos, conductores y avisos
- **Backend API (NestJS)**: Este proyecto - API REST centralizada con autenticación OTP + JWT

### Estado Actual

✅ **Fase 1 Completada** - API lista para consumo por frontend

- 46 endpoints implementados y documentados con Swagger
- 97 tests unitarios pasando
- Autenticación OTP + JWT con refresh tokens
- Rate limiting y seguridad hardenizada
- SMTP real con abstracción para desarrollo
- Documentación completa para equipos frontend

## 🚀 Características Principales

### Autenticación y Seguridad

- **OTP por email**: Autenticación sin contraseñas usando códigos de un solo uso
- **JWT con refresh tokens**: Access tokens de 15min, refresh tokens de 7 días
- **Rate limiting**: 10 req/min global, 3 req/min para endpoints de autenticación
- **Helmet**: Headers de seguridad HTTP
- **CORS configurable**: Restringido a dominios específicos
- **Trust proxy**: Configurado para funcionar detrás de nginx

### Gestión de Rutas

- CRUD completo de rutas de transporte
- Gestión de paradas con coordenadas GPS
- Ordenamiento de paradas por ruta
- Horarios por día de la semana y dirección
- Estados: ACTIVE, SUSPENDED, INACTIVE

### Gestión de Recursos

- **Vehículos**: Placa, código, capacidad, estados (ACTIVE, MAINTENANCE, INACTIVE)
- **Conductores**: Asignación a vehículos y rutas
- **Avisos**: Publicación con fechas de vigencia y severidad (INFO, WARNING, CRITICAL)

### Feedback de Viajes

- Estudiantes pueden calificar viajes (1-5 estrellas)
- Comentarios opcionales
- Historial de feedbacks por usuario y ruta

### Auditoría

- Logs de todas las acciones administrativas
- Registro de actor, acción, entidad y metadata

## 🛠️ Stack Tecnológico

- **Runtime**: Node.js v24.17.0+
- **Framework**: NestJS 11.x
- **Lenguaje**: TypeScript 5.8.3 (strict mode, zero `any`)
- **ORM**: Prisma 6.x
- **Base de datos**: PostgreSQL 16
- **Package manager**: pnpm 11.8.0+
- **Contenedores**: Docker + Docker Compose
- **Validación**: class-validator + Zod
- **Documentación**: Swagger/OpenAPI 3.0
- **Tests**: Jest (92 unit tests + e2e infrastructure)
- **Seguridad**: Helmet, @nestjs/throttler, JWT, OTP hasheado con scrypt

## 📐 Arquitectura

```
ups-api/
├── src/
│   ├── main.ts                          # Bootstrap con Helmet y trust proxy
│   ├── app.module.ts                    # Módulo raíz con ThrottlerModule
│   ├── config/
│   │   ├── env.schema.ts                # Validación Zod con SMTP y throttle
│   │   ├── app.config.ts                # Configuración tipada
│   │   └── swagger.config.ts            # Swagger setup
│   ├── database/
│   │   ├── prisma.module.ts             # Prisma global module
│   │   └── prisma.service.ts            # Prisma client wrapper
│   ├── common/
│   │   ├── decorators/                  # @CurrentUser, @Roles, @Public
│   │   ├── dto/                         # PaginationDto
│   │   ├── filters/                     # GlobalExceptionFilter
│   │   ├── guards/                      # JwtAuthGuard, RolesGuard
│   │   ├── types/                       # JwtPayload, PaginationMeta
│   │   └── utils/                       # buildPaginatedResponse
│   └── modules/
│       ├── auth/                        # OTP + JWT completo
│       │   ├── dto/                     # RequestCodeDto, VerifyCodeDto, etc.
│       │   ├── mail/                    # SMTP con abstracción
│       │   │   ├── interfaces/          # MailProvider
│       │   │   └── providers/           # SmtpMailProvider, DevMailProvider
│       │   ├── strategies/              # JwtStrategy
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   └── auth.module.ts
│       ├── health/                      # Health checks
│       ├── users/                       # User management
│       ├── routes/                      # Rutas + RouteStops ordering
│       ├── stops/                       # Paradas
│       ├── schedules/                   # Horarios
│       ├── vehicles/                    # Vehículos
│       ├── drivers/                     # Conductores
│       ├── notices/                     # Avisos
│       ├── mobile/                      # API mobile read-only
│       ├── trip-feedback/               # Feedback de viajes
│       └── audit-logs/                  # Auditoría
├── prisma/
│   ├── schema.prisma                    # 13 modelos
│   ├── seed.ts                          # Seed script
│   └── migrations/                      # Migraciones
├── test/
│   ├── e2e/                             # Tests e2e (infrastructure ready)
│   └── helpers/                         # Helpers para tests
├── docs/handoff/                        # Documentación para frontend
├── docker-compose.yml                   # PostgreSQL
├── .env.example                         # Variables de entorno
```

## 📊 Modelo de Datos

### Entidades Principales (13 modelos)

1. **User** - Usuarios del sistema (STUDENT, ADMIN, SUPER_ADMIN, DRIVER)
2. **Session** - Sesiones activas con refresh tokens hasheados
3. **AuthVerificationCode** - OTP hasheados con scrypt
4. **AllowedEmailDomain** - Dominios institucionales permitidos
5. **Route** - Rutas de transporte
6. **Stop** - Paradas con coordenadas GPS
7. **RouteStop** - Relación rutas-paradas con orden
8. **Schedule** - Horarios por día de la semana
9. **Vehicle** - Vehículos
10. **Driver** - Conductores
11. **Notice** - Avisos institucionales
12. **TripFeedback** - Calificaciones de viajes
13. **AuditLog** - Logs de auditoría

## 🔌 Endpoints (46 total)

### Health (2 endpoints)

- `GET /health` - Health check básico
- `GET /health/db` - Health check de base de datos

### Auth (5 endpoints)

- `POST /auth/request-code` - Solicitar OTP (rate limited: 3/min)
- `POST /auth/verify-code` - Verificar OTP y obtener tokens
- `POST /auth/refresh` - Renovar access token
- `POST /auth/logout` - Cerrar sesión
- `GET /auth/me` - Obtener usuario actual

### Admin API (31 endpoints) - Requiere rol ADMIN o SUPER_ADMIN

- **Routes** (6): CRUD + ordenamiento de paradas (DELETE = desactivación suave)
- **Stops** (5): CRUD con validación de coordenadas (DELETE = desactivación suave)
- **Schedules** (5): CRUD con formato HH:mm (DELETE = eliminación física)
- **Vehicles** (5): CRUD con placa/código únicos (DELETE = estado INACTIVE)
- **Drivers** (5): CRUD con asignaciones (DELETE = estado INACTIVE)
- **Notices** (5): CRUD con fechas de publicación (DELETE = desactivación suave)

### Mobile API (5 endpoints) - Requiere JWT (STUDENT, DRIVER, ADMIN, SUPER_ADMIN)

- `GET /mobile/routes` - Listar rutas activas
- `GET /mobile/routes/:id` - Detalle de ruta con paradas y horarios
- `GET /mobile/routes/:id/stops` - Paradas de ruta ordenadas
- `GET /mobile/routes/:id/schedules` - Horarios de ruta
- `GET /mobile/notices` - Avisos activos

### Trip Feedback (3 endpoints) - Requiere JWT

- `POST /trip-feedback` - Crear feedback (rating 1-5)
- `GET /trip-feedback` - Listar feedbacks con filtros (solo propios salvo admin)
- `GET /trip-feedback/:id` - Obtener feedback (solo propio salvo admin)

**Documentación completa**: http://localhost:3000/docs (Swagger UI)

## 📦 Instalación

### Prerrequisitos

- Node.js v24.17.0+
- pnpm 11.8.0+
- Docker & Docker Compose

### Pasos

1. **Clonar repositorio**

```bash
git clone https://github.com/C4rlos-Mor4n/ups-api.git
cd ups-api
```

2. **Instalar dependencias**

```bash
pnpm install
```

3. **Configurar variables de entorno**

```bash
cp .env.example .env
# Editar .env con tus valores
```

4. **Levantar PostgreSQL**

```bash
docker compose up -d
```

5. **Ejecutar migraciones**

```bash
pnpm prisma migrate deploy
```

6. **Generar Prisma Client**

```bash
pnpm prisma generate
```

7. **Seed de datos de prueba (opcional)**

```bash
pnpm prisma:seed
```

8. **Iniciar servidor de desarrollo**

```bash
pnpm start:dev
```

La API estará disponible en `http://localhost:3000`
Swagger UI en `http://localhost:3000/docs`

## 🔐 Variables de Entorno

Copiar `.env.example` a `.env` y ajustar:

### Desarrollo

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://ups_user:ups_password@localhost:5433/ups_expresos"

JWT_ACCESS_SECRET="change-me-access-secret"
JWT_REFRESH_SECRET="change-me-refresh-secret"

ALLOWED_EMAIL_DOMAINS="ups.edu.ec,est.ups.edu.ec"
SUPER_ADMIN_EMAILS="admin@ups.edu.ec"

AUTH_DEV_EXPOSE_OTP=true  # Solo desarrollo
SWAGGER_ENABLED=true
# APP_PUBLIC_URL="https://tu-dominio.com"  # Opcional, solo para Swagger
```

### Producción

```bash
NODE_ENV=production
JWT_ACCESS_SECRET="<generar-32-caracteres-minimo>"
JWT_REFRESH_SECRET="<generar-32-caracteres-minimo>"
AUTH_DEV_EXPOSE_OTP=false  # SIEMPRE false
SWAGGER_ENABLED=false

# SMTP obligatorio en producción
SMTP_HOST="smtp.ups.edu.ec"
SMTP_PORT=587
SMTP_USER="noreply@ups.edu.ec"
SMTP_PASS="password"
SMTP_FROM="noreply@ups.edu.ec"
```

Ver `.env.example` para lista completa.

## 🧪 Tests

### Tests Unitarios (97 tests)

```bash
pnpm test
```

Cobertura:

- Auth service (12 tests)
- Roles guard (6 tests)
- Routes service (7 tests)
- Route-stops service (6 tests)
- Stops service (7 tests)
- Mobile service (10 tests)
- Notices service (8 tests)
- Health (7 tests)
- TripFeedback service (20 tests)
- Mail service (9 tests)

### Tests E2E

```bash
pnpm test:e2e
```

Infraestructura lista con PostgreSQL aislado (puerto 5434).

### Validaciones

```bash
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm build         # Build de producción
pnpm prisma validate  # Validar schema
```

## 📚 Documentación para Frontend

El paquete de handoff completo está en `docs/handoff/`:

- **README.md** - Introducción al paquete
- **AUTH_FLOW.md** - Flujo completo de autenticación OTP + JWT
- **MOBILE_API_GUIDE.md** - Guía para app móvil (5 endpoints)
- **WEB_ADMIN_API_GUIDE.md** - Guía para web admin (31 endpoints)
- **ERROR_CODES.md** - Catálogo de errores HTTP
- **FRONTEND_IMPLEMENTATION_NOTES.md** - Patrones para React y Expo
- **API_CONTRACT_SUMMARY.md** - Tabla resumen de los 46 endpoints
- **ups-expresosapp-openapi.json** - Especificación OpenAPI para importar en Apidog

### Importar en Apidog

1. Abrir Apidog
2. Click en "Import Data"
3. Seleccionar "OpenAPI/Swagger"
4. Subir `docs/handoff/ups-expresosapp-openapi.json`
5. Los 46 endpoints aparecerán organizados por tags

## 📝 Scripts Disponibles

```bash
# Desarrollo
pnpm start:dev              # Servidor con hot reload

# Producción
pnpm build                  # Build para producción
pnpm start:prod             # Ejecutar build de producción

# Calidad
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript type checking
pnpm test                   # Tests unitarios
pnpm test:e2e               # Tests end-to-end

# Base de datos
pnpm prisma:validate        # Validar schema
pnpm prisma:generate        # Generar Prisma Client
pnpm prisma:migrate         # Ejecutar migraciones
pnpm prisma:seed            # Seed de datos
pnpm prisma:studio          # Abrir Prisma Studio

# Documentación
pnpm export:openapi         # Exportar OpenAPI spec a JSON
```

## 🔒 Seguridad

### Implementada

- ✅ OTP hasheado con scrypt (nunca en texto plano)
- ✅ Refresh tokens hasheados con SHA-256
- ✅ Validación de usuario activo en cada request JWT (`isActive`)
- ✅ Acceso a feedbacks restringido al propio usuario (admin puede ver todos)
- ✅ Rate limiting (10 req/min global, 3 req/min auth)
- ✅ Helmet (headers de seguridad HTTP)
- ✅ CORS restringido
- ✅ Trust proxy para X-Forwarded-For
- ✅ Validación de inputs con class-validator
- ✅ Variables de entorno validadas con Zod
- ✅ No uso de `any` en TypeScript (zero tolerance)

### Buenas prácticas

- No guardar OTP en texto plano
- No guardar refresh tokens en texto plano
- No loguear tokens ni OTP
- Rotación de refresh tokens en cada uso
- Sesiones revocables

## 📄 Licencia

Este proyecto es propiedad de la Universidad Politécnica Salesiana.

## 👥 Equipo

- **Backend**: Carlos Morán

## 📞 Soporte

Para dudas sobre la API, consultar:

1. Swagger UI: http://localhost:3000/docs (con `SWAGGER_ENABLED=true`)
2. OpenAPI spec: `docs/handoff/ups-expresosapp-openapi.json`
3. Documentación en `docs/handoff/`
4. Auditoría y plan de limpieza: `docs/AUDITORIA_2026-08-19.md`

---

**Proyecto**: UPS ExpresosApp API  
**Versión**: 1.0.0  
**Última actualización**: 2026-07-05  
**Estado**: ✅ Completado - API en producción

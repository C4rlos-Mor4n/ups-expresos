# Resumen de Contrato API - UPS ExpresosApp API

Tabla completa de los 46 endpoints disponibles en la API, organizados por modulo.

## Leyenda

| Columna | Descripcion |
|---------|-------------|
| **Metodo** | HTTP method (GET, POST, PATCH, DELETE) |
| **Ruta** | Path del endpoint |
| **Modulo** | Modulo de NestJS al que pertenece |
| **Proteccion** | Tipo de autenticacion requerida |
| **Rol** | Roles permitidos para acceder |
| **Usado por** | Equipo frontend que consume el endpoint |

### Valores de Proteccion

| Valor | Descripcion |
|-------|-------------|
| Publico | No requiere autenticacion |
| JWT | Requiere header `Authorization: Bearer <accessToken>` |

### Valores de Rol

| Valor | Descripcion |
|-------|-------------|
| - | Sin restriccion de rol |
| Any | Cualquier usuario autenticado |
| ADMIN, SUPER_ADMIN | Solo administradores |
| STUDENT, ADMIN, SUPER_ADMIN | Estudiantes y administradores |

---

## Health (2 endpoints)

| Metodo | Ruta | Modulo | Proteccion | Rol | Usado por |
|--------|------|--------|------------|-----|-----------|
| GET | `/health` | Health | Publico | - | Both |
| GET | `/health/db` | Health | Publico | - | Both |

---

## Auth (5 endpoints)

| Metodo | Ruta | Modulo | Proteccion | Rol | Usado por |
|--------|------|--------|------------|-----|-----------|
| POST | `/auth/request-code` | Auth | Publico | - | Both |
| POST | `/auth/verify-code` | Auth | Publico | - | Both |
| POST | `/auth/refresh` | Auth | Publico | - | Both |
| POST | `/auth/logout` | Auth | JWT | Any | Both |
| GET | `/auth/me` | Auth | JWT | Any | Both |

---

## Admin Routes (6 endpoints)

| Metodo | Ruta | Modulo | Proteccion | Rol | Usado por |
|--------|------|--------|------------|-----|-----------|
| POST | `/admin/routes` | Admin Routes | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/routes` | Admin Routes | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/routes/:id` | Admin Routes | JWT | ADMIN, SUPER_ADMIN | Web |
| PATCH | `/admin/routes/:id` | Admin Routes | JWT | ADMIN, SUPER_ADMIN | Web |
| PATCH | `/admin/routes/:id/stops/order` | Admin Routes | JWT | ADMIN, SUPER_ADMIN | Web |
| DELETE | `/admin/routes/:id` | Admin Routes | JWT | ADMIN, SUPER_ADMIN | Web |

---

## Admin Stops (5 endpoints)

| Metodo | Ruta | Modulo | Proteccion | Rol | Usado por |
|--------|------|--------|------------|-----|-----------|
| POST | `/admin/stops` | Admin Stops | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/stops` | Admin Stops | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/stops/:id` | Admin Stops | JWT | ADMIN, SUPER_ADMIN | Web |
| PATCH | `/admin/stops/:id` | Admin Stops | JWT | ADMIN, SUPER_ADMIN | Web |
| DELETE | `/admin/stops/:id` | Admin Stops | JWT | ADMIN, SUPER_ADMIN | Web |

---

## Admin Schedules (5 endpoints)

| Metodo | Ruta | Modulo | Proteccion | Rol | Usado por |
|--------|------|--------|------------|-----|-----------|
| POST | `/admin/schedules` | Admin Schedules | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/schedules` | Admin Schedules | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/schedules/:id` | Admin Schedules | JWT | ADMIN, SUPER_ADMIN | Web |
| PATCH | `/admin/schedules/:id` | Admin Schedules | JWT | ADMIN, SUPER_ADMIN | Web |
| DELETE | `/admin/schedules/:id` | Admin Schedules | JWT | ADMIN, SUPER_ADMIN | Web |

---

## Admin Vehicles (5 endpoints)

| Metodo | Ruta | Modulo | Proteccion | Rol | Usado por |
|--------|------|--------|------------|-----|-----------|
| POST | `/admin/vehicles` | Admin Vehicles | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/vehicles` | Admin Vehicles | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/vehicles/:id` | Admin Vehicles | JWT | ADMIN, SUPER_ADMIN | Web |
| PATCH | `/admin/vehicles/:id` | Admin Vehicles | JWT | ADMIN, SUPER_ADMIN | Web |
| DELETE | `/admin/vehicles/:id` | Admin Vehicles | JWT | ADMIN, SUPER_ADMIN | Web |

---

## Admin Drivers (5 endpoints)

| Metodo | Ruta | Modulo | Proteccion | Rol | Usado por |
|--------|------|--------|------------|-----|-----------|
| POST | `/admin/drivers` | Admin Drivers | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/drivers` | Admin Drivers | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/drivers/:id` | Admin Drivers | JWT | ADMIN, SUPER_ADMIN | Web |
| PATCH | `/admin/drivers/:id` | Admin Drivers | JWT | ADMIN, SUPER_ADMIN | Web |
| DELETE | `/admin/drivers/:id` | Admin Drivers | JWT | ADMIN, SUPER_ADMIN | Web |

---

## Admin Notices (5 endpoints)

| Metodo | Ruta | Modulo | Proteccion | Rol | Usado por |
|--------|------|--------|------------|-----|-----------|
| POST | `/admin/notices` | Admin Notices | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/notices` | Admin Notices | JWT | ADMIN, SUPER_ADMIN | Web |
| GET | `/admin/notices/:id` | Admin Notices | JWT | ADMIN, SUPER_ADMIN | Web |
| PATCH | `/admin/notices/:id` | Admin Notices | JWT | ADMIN, SUPER_ADMIN | Web |
| DELETE | `/admin/notices/:id` | Admin Notices | JWT | ADMIN, SUPER_ADMIN | Web |

---

## Mobile (5 endpoints)

| Metodo | Ruta | Modulo | Proteccion | Rol | Usado por |
|--------|------|--------|------------|-----|-----------|
| GET | `/mobile/routes` | Mobile | JWT | STUDENT, DRIVER, ADMIN, SUPER_ADMIN | Mobile |
| GET | `/mobile/routes/:id` | Mobile | JWT | STUDENT, DRIVER, ADMIN, SUPER_ADMIN | Mobile |
| GET | `/mobile/routes/:id/stops` | Mobile | JWT | STUDENT, DRIVER, ADMIN, SUPER_ADMIN | Mobile |
| GET | `/mobile/routes/:id/schedules` | Mobile | JWT | STUDENT, DRIVER, ADMIN, SUPER_ADMIN | Mobile |
| GET | `/mobile/notices` | Mobile | JWT | STUDENT, DRIVER, ADMIN, SUPER_ADMIN | Mobile |

---

## Trip Feedback (3 endpoints)

| Metodo | Ruta | Modulo | Proteccion | Rol | Usado por |
|--------|------|--------|------------|-----|-----------|
| POST | `/trip-feedback` | Trip Feedback | JWT | Any | Mobile |
| GET | `/trip-feedback` | Trip Feedback | JWT | Any | Both |
| GET | `/trip-feedback/:id` | Trip Feedback | JWT | Any | Both |

---

## Resumen por equipo consumidor

### Web Admin (React) - 34 endpoints

| Categoria | Cantidad | Endpoints |
|-----------|----------|-----------|
| Auth | 5 | request-code, verify-code, refresh, logout, me |
| Admin Routes | 6 | CRUD + order stops |
| Admin Stops | 5 | CRUD |
| Admin Schedules | 5 | CRUD |
| Admin Vehicles | 5 | CRUD |
| Admin Drivers | 5 | CRUD |
| Admin Notices | 5 | CRUD |
| Trip Feedback | 2 | list, detail |
| **Total** | **34** | |

### App Movil (Expo) - 13 endpoints

| Categoria | Cantidad | Endpoints |
|-----------|----------|-----------|
| Auth | 5 | request-code, verify-code, refresh, logout, me |
| Mobile Routes | 5 | list, detail, stops, schedules, notices |
| Trip Feedback | 3 | create, list, detail |
| **Total** | **13** | |

### Ambos equipos - 8 endpoints compartidos

| Categoria | Cantidad | Endpoints |
|-----------|----------|-----------|
| Health | 2 | health, health/db |
| Auth | 5 | request-code, verify-code, refresh, logout, me |
| Trip Feedback | 2 | list, detail |
| **Total** | **8** | |

---

## Resumen por tipo de operacion

| Metodo | Cantidad | Descripcion |
|--------|----------|-------------|
| GET | 22 | Lectura de datos |
| POST | 11 | Creacion de recursos + auth |
| PATCH | 7 | Actualizacion parcial |
| DELETE | 6 | Eliminacion (suave o fisica) |
| **Total** | **46** | |

---

## Resumen por nivel de proteccion

| Proteccion | Cantidad | Endpoints |
|------------|----------|-----------|
| Publico | 5 | health, health/db, request-code, verify-code, refresh |
| JWT (Any) | 5 | me, logout, trip-feedback (3) |
| JWT (ADMIN/SUPER_ADMIN) | 31 | Todos los /admin/* |
| JWT (STUDENT+DRIVER+ADMIN+SUPER_ADMIN) | 5 | Todos los /mobile/* |

> **Nota:** `/auth/logout` requiere JWT (no es `@Public()`). Los endpoints `GET` de trip-feedback restringen la lectura a feedbacks propios salvo para ADMIN/SUPER_ADMIN.

---

## Endpoints publicos (sin autenticacion)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/health` | Health check basico |
| GET | `/health/db` | Health check de base de datos |
| POST | `/auth/request-code` | Solicitar codigo OTP |
| POST | `/auth/verify-code` | Verificar OTP y obtener tokens |
| POST | `/auth/refresh` | Renovar access token |

---

## Endpoints con rate limiting especial

| Metodo | Ruta | Limite | Ventana |
|--------|------|--------|---------|
| POST | `/auth/request-code` | 3 requests | 60 segundos |
| POST | `/auth/verify-code` | 3 requests | 60 segundos |
| Todos los demas | - | 10 requests | 60 segundos |

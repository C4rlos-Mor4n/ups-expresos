# UPS ExpresosApp API - Paquete de Handoff para Frontend

Este paquete contiene toda la documentacion necesaria para que los equipos de **Web Admin (React)** y **App Movil (Expo)** consuman la API de UPS ExpresosApp.

## Contenido del paquete

| Archivo | Descripcion |
|---------|-------------|
| `ups-expresosapp-openapi.json` | Especificacion OpenAPI 3.0 completa con los 46 endpoints. Importar en Apidog, Swagger UI o Postman. |
| `AUTH_FLOW.md` | Flujo completo de autenticacion OTP + JWT (request-code, verify-code, refresh, logout). |
| `MOBILE_API_GUIDE.md` | Guia de endpoints para la App Movil (Expo): rutas, paradas, horarios, avisos y feedback. |
| `WEB_ADMIN_API_GUIDE.md` | Guia de endpoints para Web Administrativa (React): CRUD de rutas, paradas, horarios, vehiculos, conductores y avisos. |
| `ERROR_CODES.md` | Catalogo de codigos HTTP de error, causas y como manejarlos en la UI. |
| `FRONTEND_IMPLEMENTATION_NOTES.md` | Notas de implementacion: Axios interceptors, TanStack Query, SecureStore, refresh automatico. |
| `API_CONTRACT_SUMMARY.md` | Tabla resumen de los 46 endpoints con metodo, ruta, modulo, proteccion, rol y consumidor. |

## Como importar el OpenAPI en Apidog

1. Abrir **Apidog** (desktop o web)
2. Click en **"Import Data"** (icono de flecha hacia abajo en el panel izquierdo)
3. Seleccionar formato **"OpenAPI/Swagger"**
4. Subir el archivo `ups-expresosapp-openapi.json`
5. Los 46 endpoints apareceran organizados por tags:
   - **Health** (2 endpoints)
   - **Auth** (5 endpoints)
   - **Admin Routes** (6 endpoints)
   - **Admin Stops** (4 endpoints)
   - **Admin Schedules** (4 endpoints)
   - **Admin Vehicles** (4 endpoints)
   - **Admin Drivers** (4 endpoints)
   - **Admin Notices** (4 endpoints)
   - **Mobile** (5 endpoints)
   - **Trip Feedback** (3 endpoints)

> **Nota:** Tambien puedes importar este archivo en Postman, Insomnia, Swagger UI o cualquier herramienta compatible con OpenAPI 3.0.

## Base URLs

| Entorno | URL | Estado |
|---------|-----|--------|
| Local (desarrollo) | `http://localhost:3000` | Activo |

> La API corre por defecto en el puerto **3000**. El path de Swagger UI local es `http://localhost:3000/docs` (con `SWAGGER_ENABLED=true`).

## Autenticacion rapida

Todos los endpoints protegidos requieren un header `Authorization: Bearer <accessToken>`.

El flujo completo esta documentado en [`AUTH_FLOW.md`](./AUTH_FLOW.md), pero en resumen:

1. `POST /auth/request-code` - Solicitar codigo OTP al email institucional
2. `POST /auth/verify-code` - Verificar codigo y obtener `accessToken` + `refreshToken`
3. Usar `accessToken` en el header `Authorization` para todos los requests
4. `POST /auth/refresh` - Renovar tokens antes de que expiren
5. `POST /auth/logout` - Cerrar sesion y revocar tokens

## Roles de usuario

| Rol | Descripcion | Acceso |
|-----|-------------|--------|
| `STUDENT` | Estudiante de la UPS | Endpoints `/mobile/*` y `/trip-feedback` |
| `ADMIN` | Administrador | Endpoints `/admin/*` + `/mobile/*` + `/trip-feedback` |
| `SUPER_ADMIN` | Super administrador | Mismos que ADMIN, con permisos elevados |
| `DRIVER` | Conductor | Endpoints publicos y de autenticacion |

## Dominios de email permitidos

La API valida que el email pertenezca a dominios institucionales de la UPS. Los usuarios nuevos se registran automaticamente con rol `STUDENT` al verificar su email.

## Seguridad

- **Rate limiting:** 3 requests/min en endpoints de auth, 10 requests/min global
- **Helmet:** Headers de seguridad HTTP configurados
- **CORS:** Configurado para origenes especificos
- **JWT:** Access token (15 min) + Refresh token (7 dias) con rotacion automatica
- **OTP:** Codigo de 6 digitos con hash scrypt, expira en 10 minutos, maximo 5 intentos

## NO incluir

- Secrets ni archivos `.env`
- Credenciales de base de datos
- Tokens JWT reales
- Configuracion SMTP

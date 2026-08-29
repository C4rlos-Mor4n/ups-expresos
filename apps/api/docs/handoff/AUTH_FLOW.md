# Flujo de autenticación — UPS GO API

La API utiliza un sistema de autenticacion basado en **OTP (One-Time Password) por email** + **JWT (JSON Web Tokens)** con rotacion de refresh tokens.

## Resumen del flujo

```
┌─────────┐     POST /auth/request-code     ┌─────┐
│  Client  │ ─────────────────────────────── │ API │
│ (Web/App)│ ◄── 201 { message, devCode? } ── │     │
│          │                                  │     │
│          │     POST /auth/verify-code       │     │
│          │ ─────────────────────────────── │     │
│          │ ◄── 201 { accessToken,          │     │
│          │      refreshToken, user }        │     │
│          │                                  │     │
│          │     GET /auth/me                 │     │
│          │ ─── Bearer <accessToken> ──────►│     │
│          │ ◄── 200 { user } ────────────── │     │
│          │                                  │     │
│          │     POST /auth/refresh           │     │
│          │ ─── { refreshToken } ──────────►│     │
│          │ ◄── 201 { new tokens } ──────── │     │
│          │                                  │     │
│          │     POST /auth/logout            │     │
│          │ ─── Bearer + { refreshToken } ─►│     │
│          │ ◄── 200 { message } ─────────── │     │
└─────────┘                                  └─────┘
```

---

## Paso 1: Solicitar codigo OTP

Solicita un codigo de verificacion de 6 digitos que se envia al email institucional del usuario.

```http
POST /auth/request-code
Content-Type: application/json

{
  "email": "usuario@est.ups.edu.ec"
}
```

### Request

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `email` | string (email) | Si | Email institucional. Debe pertenecer a un dominio permitido. |

### Response 201

```json
{
  "message": "Verification code sent"
}
```

> **En desarrollo** (`AUTH_DEV_EXPOSE_OTP=true`), la respuesta incluye el campo `devCode` con el codigo OTP en texto plano para facilitar testing sin SMTP.

### Errores posibles

| Status | Causa | Mensaje |
|--------|-------|---------|
| 400 | Dominio de email no permitido | `Email domain is not allowed` |
| 400 | Email invalido | Error de validacion del DTO |
| 429 | Rate limit excedido (3 req/min) | `ThrottlerException: Too many requests` |

### Notas

- El codigo OTP expira en **10 minutos** (configurable con `OTP_EXPIRES_MINUTES`)
- Se permiten maximo **5 intentos** de verificacion (configurable con `OTP_MAX_ATTEMPTS`)
- Si el email no existe, se crea automaticamente un usuario con rol `STUDENT`
- El codigo se almacena hasheado con **scrypt** (salt + hash)

---

## Paso 2: Verificar codigo y obtener tokens

Verifica el codigo OTP recibido por email y obtiene los tokens de sesion.

```http
POST /auth/verify-code
Content-Type: application/json

{
  "email": "usuario@est.ups.edu.ec",
  "code": "123456"
}
```

### Request

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `email` | string (email) | Si | Mismo email usado en request-code |
| `code` | string (6 caracteres) | Si | Codigo OTP de 6 digitos recibido por email |

### Response 201

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@est.ups.edu.ec",
    "name": null,
    "role": "STUDENT",
    "emailVerified": true,
    "isActive": true
  }
}
```

### Errores posibles

| Status | Causa | Mensaje |
|--------|-------|---------|
| 401 | Codigo invalido o expirado | `Invalid or expired verification code` |
| 401 | Maximo de intentos excedido | `Maximum verification attempts exceeded` |

### Notas

- El `accessToken` tiene una vigencia de **15 minutos** (configurable con `JWT_ACCESS_EXPIRES_IN`)
- El `refreshToken` tiene una vigencia de **7 dias** (configurable con `JWT_REFRESH_EXPIRES_IN`)
- Al verificar correctamente, el usuario se marca como `emailVerified: true`
- Se crea una nueva sesion en la tabla `sessions` con el hash del refresh token
- El codigo OTP se marca como usado (`usedAt`) y no puede reutilizarse

---

## Paso 3: Usar access token

Incluir el `accessToken` en el header `Authorization` de todos los endpoints protegidos.

```http
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response 200

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "usuario@est.ups.edu.ec",
  "name": null,
  "role": "STUDENT",
  "emailVerified": true,
  "isActive": true
}
```

### Errores posibles

| Status | Causa | Mensaje |
|--------|-------|---------|
| 401 | Token ausente | `Unauthorized` |
| 401 | Token expirado | `Unauthorized` |
| 401 | Token invalido | `Unauthorized` |
| 401 | Usuario inactivo | `Unauthorized` |
| 403 | Rol insuficiente para el recurso | `Forbidden resource` |

### Notas

- El JWT payload contiene: `sub` (userId), `email`, `role`
- El `JwtAuthGuard` valida el token en cada request protegido
- El `RolesGuard` valida que el rol del usuario tenga acceso al recurso
- Si el usuario esta marcado como `isActive: false`, el token es rechazado

---

## Paso 4: Renovar tokens

Renueva el access token usando el refresh token antes de que expire. Este endpoint implementa **rotacion de refresh tokens**: cada refresh genera una nueva sesion y revoca la anterior.

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Request

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `refreshToken` | string | Si | Refresh token obtenido del login o refresh anterior |

### Response 201

```json
{
  "accessToken": "eyJhbGciOi...(nuevo)",
  "refreshToken": "eyJhbGciOi...(nuevo)",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@est.ups.edu.ec",
    "name": null,
    "role": "STUDENT",
    "emailVerified": true,
    "isActive": true
  }
}
```

### Errores posibles

| Status | Causa | Mensaje |
|--------|-------|---------|
| 401 | Refresh token invalido | `Invalid refresh token` |
| 401 | Tipo de token incorrecto | `Invalid token type` |
| 401 | Sesion expirada o revocada | `Session expired or revoked` |

### Notas

- **Rotacion de tokens:** La sesion anterior se revoca automaticamente (`revokedAt` se marca)
- El nuevo refresh token tiene una nueva sesion asociada
- Si se intenta reutilizar un refresh token ya rotado, sera rechazado
- **Importante:** Implementar refresh automatico en el cliente antes de que el access token expire

---

## Paso 5: Logout

Cierra la sesion y revoca el refresh token.

```http
POST /auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Request

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `refreshToken` | string | No | Refresh token a revocar. Si no se envia, retorna exito sin revocar. |

> **Nota:** Aunque el endpoint esta marcado como `@Public()` en el controlador, se recomienda enviar el `Authorization: Bearer` header para identificar la sesion.

### Response 200

```json
{
  "message": "Logged out"
}
```

### Notas

- El refresh token se revoca marcando `revokedAt` en la sesion
- Si el refresh token es invalido o ya expiro, retorna exito de todas formas
- Limpiar los tokens almacenados en el cliente despues del logout

---

## Almacenamiento de tokens

### Web (React / Next.js)

```typescript
// Opcion 1: localStorage (con precauciones XSS)
localStorage.setItem('accessToken', tokens.accessToken);
localStorage.setItem('refreshToken', tokens.refreshToken);

// Opcion 2: sessionStorage (mas seguro, se limpia al cerrar pestaña)
sessionStorage.setItem('accessToken', tokens.accessToken);
```

> **Precaucion:** Si usas localStorage, asegurate de implementar proteccion contra XSS (Content Security Policy, sanitizacion de inputs). Nunca almacenes tokens en cookies sin flags `httpOnly` + `secure` + `sameSite=strict`.

### Movil (Expo)

```typescript
import * as SecureStore from 'expo-secure-store';

// Almacenar tokens de forma segura
await SecureStore.setItemAsync('accessToken', tokens.accessToken);
await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);

// Obtener tokens
const accessToken = await SecureStore.getItemAsync('accessToken');
const refreshToken = await SecureStore.getItemAsync('refreshToken');

// Limpiar tokens en logout
await SecureStore.deleteItemAsync('accessToken');
await SecureStore.deleteItemAsync('refreshToken');
```

> **Nota:** En Android, `expo-secure-store` usa `Keystore`. En iOS, usa `Keychain`. Los tokens estan cifrados en el dispositivo.

---

## Estrategia de renovacion automatica

### Para Web (Axios interceptor)

```typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
```

### Para Movil (verificar expiracion antes de cada request)

```typescript
import { jwtDecode } from 'jwt-decode';

function isTokenExpiringSoon(token: string, thresholdSeconds = 120): boolean {
  const decoded = jwtDecode<{ exp: number }>(token);
  if (!decoded.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp - now < thresholdSeconds;
}

async function getValidAccessToken(): Promise<string> {
  let accessToken = await SecureStore.getItemAsync('accessToken');

  if (accessToken && !isTokenExpiringSoon(accessToken)) {
    return accessToken;
  }

  // Renovar token
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const { data } = await api.post('/auth/refresh', { refreshToken });
  await SecureStore.setItemAsync('accessToken', data.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.refreshToken);

  return data.accessToken;
}
```

---

## Errores comunes y como manejarlos

| Status | Causa | Accion en UI |
|--------|-------|--------------|
| 401 | Token invalido, expirado o usuario inactivo | Redirigir a login, limpiar tokens almacenados |
| 403 | Dominio no permitido o rol insuficiente | Mostrar "No tienes permisos para esta accion" |
| 429 | Rate limit excedido (3/min en auth) | Mostrar "Demasiados intentos. Espera 1 minuto." |
| 401 (verify-code) | Codigo OTP invalido o expirado | Mostrar "Codigo invalido. Solicita uno nuevo." |
| 401 (verify-code) | Maximo de intentos excedido | Mostrar "Demasiados intentos. Solicita un nuevo codigo." |
| 401 (refresh) | Sesion expirada o revocada | Redirigir a login, limpiar tokens |

---

## Configuracion del servidor (referencia)

| Parametro | Valor por defecto | Descripcion |
|-----------|-------------------|-------------|
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Vigencia del access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Vigencia del refresh token |
| `OTP_EXPIRES_MINUTES` | `10` | Minutos antes de que expire el codigo OTP |
| `OTP_MAX_ATTEMPTS` | `5` | Maximo de intentos de verificacion |
| `THROTTLE_AUTH_TTL` | `60000` | Ventana de rate limit para auth (ms) |
| `THROTTLE_AUTH_LIMIT` | `3` | Maximo de requests de auth por ventana |
| `AUTH_DEV_EXPOSE_OTP` | `false` | Exponer OTP en respuesta (solo desarrollo) |

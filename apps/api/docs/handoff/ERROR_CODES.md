# Catalogo de Codigos de Error - UPS ExpresosApp API

Este documento describe todos los codigos HTTP de error que retorna la API, sus causas y como manejarlos en la UI.

## Formato de respuesta de error

Todos los errores siguen el formato estandar de NestJS:

```json
{
  "statusCode": 400,
  "message": "Descripcion del error",
  "error": "Bad Request"
}
```

Para errores de validacion (DTO), el campo `message` es un array de strings:

```json
{
  "statusCode": 400,
  "message": [
    "latitude must be between -90 and 90",
    "longitude must be between -180 and 180"
  ],
  "error": "Bad Request"
}
```

---

## 400 Bad Request

**Causa:** La validacion del DTO fallo. Campos invalidos, formato incorrecto o datos faltantes.

### Ejemplos comunes

**Validacion de coordenadas:**
```json
{
  "statusCode": 400,
  "message": ["latitude must be between -90 and 90"],
  "error": "Bad Request"
}
```

**Formato de hora invalido:**
```json
{
  "statusCode": 400,
  "message": ["departureTime must be in HH:mm format"],
  "error": "Bad Request"
}
```

**Email de dominio no permitido:**
```json
{
  "statusCode": 400,
  "message": "Email domain is not allowed",
  "error": "Bad Request"
}
```

**Rating fuera de rango:**
```json
{
  "statusCode": 400,
  "message": ["rating must not be less than 1", "rating must not be greater than 5"],
  "error": "Bad Request"
}
```

**UUID invalido:**
```json
{
  "statusCode": 400,
  "message": ["routeId must be a UUID"],
  "error": "Bad Request"
}
```

### Como manejarlo en la UI

- **Web:** Mostrar mensajes de validacion junto a cada campo especifico del formulario
- **Movil:** Mostrar toast o alerta con el mensaje de error
- Si `message` es un array, iterar y mostrar cada mensaje en su campo correspondiente
- Si `message` es un string, mostrarlo como mensaje general

```typescript
// Ejemplo React
if (error.response?.status === 400) {
  const messages = Array.isArray(error.response.data.message)
    ? error.response.data.message
    : [error.response.data.message];
  
  messages.forEach((msg) => {
    // Asignar mensaje al campo correspondiente
    setFieldError(extractFieldName(msg), msg);
  });
}
```

---

## 401 Unauthorized

**Causa:** Token ausente, expirado o invalido. Tambien cuando el codigo OTP es incorrecto o la sesion fue revocada.

### Ejemplos comunes

**Token ausente o expirado:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**Codigo OTP invalido:**
```json
{
  "statusCode": 401,
  "message": "Invalid or expired verification code",
  "error": "Unauthorized"
}
```

**Maximo de intentos OTP excedido:**
```json
{
  "statusCode": 401,
  "message": "Maximum verification attempts exceeded",
  "error": "Unauthorized"
}
```

**Refresh token invalido:**
```json
{
  "statusCode": 401,
  "message": "Invalid refresh token",
  "error": "Unauthorized"
}
```

**Sesion expirada o revocada:**
```json
{
  "statusCode": 401,
  "message": "Session expired or revoked",
  "error": "Unauthorized"
}
```

### Como manejarlo en la UI

- **Redirigir inmediatamente a la pantalla de login**
- **Limpiar todos los tokens almacenados** (localStorage, SecureStore, etc.)
- **No mostrar el error tecnico al usuario**, solo "Sesion expirada. Inicia sesion nuevamente."
- En el caso de OTP invalido, mostrar "Codigo incorrecto. Verifica e intenta de nuevo."
- En el caso de maximo de intentos, mostrar "Demasiados intentos. Solicita un nuevo codigo."

```typescript
// Ejemplo interceptor Axios
if (error.response?.status === 401) {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
}
```

---

## 403 Forbidden

**Causa:** El usuario autenticado no tiene permisos suficientes para acceder al recurso, o el dominio de email no esta permitido.

### Ejemplos comunes

**Rol insuficiente:**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

**Dominio de email no permitido:**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### Como manejarlo en la UI

- Mostrar mensaje claro: **"No tienes permisos para realizar esta accion"**
- **NO redirigir a login** (el usuario esta autenticado, solo no tiene permisos)
- En Web Admin: si un STUDENT intenta acceder, mostrar pantalla de "Acceso restringido"
- Considerar ocultar botones/acciones que el usuario no pueda ejecutar segun su rol

```typescript
// Ejemplo React
if (error.response?.status === 403) {
  toast.error('No tienes permisos para realizar esta accion');
  // O mostrar componente de acceso restringido
  setAccessDenied(true);
}
```

---

## 404 Not Found

**Causa:** El recurso solicitado no existe en la base de datos.

### Ejemplos comunes

**Ruta no encontrada:**
```json
{
  "statusCode": 404,
  "message": "Route with id xyz not found",
  "error": "Not Found"
}
```

**Parada no encontrada:**
```json
{
  "statusCode": 404,
  "message": "Stop with id xyz not found",
  "error": "Not Found"
}
```

**Horario no encontrado:**
```json
{
  "statusCode": 404,
  "message": "Schedule with id xyz not found",
  "error": "Not Found"
}
```

**Vehiculo no encontrado:**
```json
{
  "statusCode": 404,
  "message": "Vehicle with id xyz not found",
  "error": "Not Found"
}
```

**Conductor no encontrado:**
```json
{
  "statusCode": 404,
  "message": "Driver with id xyz not found",
  "error": "Not Found"
}
```

**Aviso no encontrado:**
```json
{
  "statusCode": 404,
  "message": "Notice with id xyz not found",
  "error": "Not Found"
}
```

**Feedback no encontrado:**
```json
{
  "statusCode": 404,
  "message": "TripFeedback with id xyz not found",
  "error": "Not Found"
}
```

**Usuario no encontrado:**
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

### Como manejarlo en la UI

- **Web Admin:** Mostrar "Recurso no encontrado" y redirigir a la lista correspondiente
- **Movil:** Mostrar "El recurso no esta disponible" o navegar atras
- Si el ID viene de la URL y el recurso no existe, probablemente fue eliminado

```typescript
// Ejemplo React
if (error.response?.status === 404) {
  toast.error('Recurso no encontrado');
  navigate('/admin/routes'); // Redirigir a lista
}
```

---

## 409 Conflict

**Causa:** Conflicto de unicidad en la base de datos. Un valor que debe ser unico ya existe.

### Ejemplos comunes

**Email duplicado:**
```json
{
  "statusCode": 409,
  "message": "Email already exists",
  "error": "Conflict"
}
```

**Placa de vehiculo duplicada:**
```json
{
  "statusCode": 409,
  "message": "Vehicle plate or code already exists",
  "error": "Conflict"
}
```

**Codigo interno de vehiculo duplicado:**
```json
{
  "statusCode": 409,
  "message": "Vehicle plate or code already exists",
  "error": "Conflict"
}
```

### Como manejarlo en la UI

- Mostrar mensaje: **"Este valor ya esta en uso. Usa otro diferente."**
- En formularios: resaltar el campo especifico que causa el conflicto
- En Web Admin: si la placa ya existe, mostrar "La placa ABC-1234 ya esta registrada"

```typescript
// Ejemplo React
if (error.response?.status === 409) {
  const msg = error.response.data.message;
  if (msg.includes('plate') || msg.includes('code')) {
    setFieldError('plate', 'La placa o codigo ya estan en uso');
  }
  toast.error('Este valor ya esta registrado');
}
```

---

## 429 Too Many Requests

**Causa:** Se excedio el limite de requests (rate limiting).

### Configuracion actual

| Endpoint | Limite | Ventana |
|----------|--------|---------|
| `/auth/request-code` | 3 requests | 60 segundos |
| `/auth/verify-code` | 3 requests | 60 segundos |
| Todos los demas | 10 requests | 60 segundos |

### Ejemplo

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too many requests",
  "error": "Too Many Requests"
}
```

### Como manejarlo en la UI

- Mostrar mensaje: **"Demasiados intentos. Espera 1 minuto e intenta de nuevo."**
- **Deshabilitar el boton de enviar** temporalmente (60 segundos)
- Mostrar un countdown timer si es posible
- En auth: "Espera antes de solicitar un nuevo codigo"

```typescript
// Ejemplo React
if (error.response?.status === 429) {
  setCooldown(60); // Deshabilitar boton por 60 segundos
  toast.error('Demasiados intentos. Espera 1 minuto.');
  
  const timer = setInterval(() => {
    setCooldown((prev) => {
      if (prev <= 1) {
        clearInterval(timer);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
}
```

---

## 500 Internal Server Error

**Causa:** Error inesperado del servidor. El equipo de backend debe investigar.

### Ejemplo

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

### Como manejarlo en la UI

- Mostrar mensaje generico: **"Error interno. Intenta mas tarde."**
- **NO mostrar detalles tecnicos al usuario**
- Registrar el error en un servicio de monitoreo (Sentry, etc.)
- En Web Admin: mostrar boton de "Reintentar"

```typescript
// Ejemplo React
if (error.response?.status >= 500) {
  toast.error('Error del servidor. Intenta mas tarde.');
  // Enviar a servicio de monitoreo
  Sentry.captureException(error);
}
```

---

## Tabla resumen

| Status | Causa principal | Accion UI | Mensaje usuario |
|--------|-----------------|-----------|-----------------|
| 400 | Validacion fallida | Mostrar errores en campos | Mensajes especificos de validacion |
| 401 | Token invalido/expirado | Redirigir a login, limpiar tokens | "Sesion expirada. Inicia sesion." |
| 403 | Rol insuficiente | Mostrar acceso restringido | "No tienes permisos" |
| 404 | Recurso no existe | Redirigir a lista | "Recurso no encontrado" |
| 409 | Valor duplicado | Resaltar campo en formulario | "Este valor ya esta en uso" |
| 429 | Rate limit excedido | Deshabilitar boton + countdown | "Espera 1 minuto" |
| 500 | Error del servidor | Mostrar error generico + reintentar | "Error interno. Intenta mas tarde." |

---

## Manejo centralizado de errores (ejemplo)

```typescript
// api/error-handler.ts
import axios from 'axios';

export function handleApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return 'Error inesperado';
  }

  const status = error.response?.status;
  const data = error.response?.data;

  switch (status) {
    case 400: {
      const messages = Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message || 'Datos invalidos';
      return messages;
    }
    case 401:
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      return 'Sesion expirada';

    case 403:
      return 'No tienes permisos para esta accion';

    case 404:
      return 'Recurso no encontrado';

    case 409:
      return 'Este valor ya esta en uso';

    case 429:
      return 'Demasiados intentos. Espera 1 minuto.';

    case 500:
    default:
      return 'Error del servidor. Intenta mas tarde.';
  }
}
```

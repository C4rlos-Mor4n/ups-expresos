# Auditoría completa de Swagger/OpenAPI y rutas — UPS ExpresosApp API

**Fecha de auditoría:** 2026-07-09  
**Base URL auditada:** `https://robust-strong-cattle.ngrok-free.app`  
**Repositorio auditado:** `ups-api`  
**Objetivo:** validar que la documentación Swagger/OpenAPI esté bien hecha, que cada ruta esté correctamente documentada y que funcione de verdad.

---

## 1. Resumen ejecutivo

## Resultado general

- **Rutas auditadas funcionalmente:** 40/40 OK
- **Swagger/OpenAPI:** funcional como contrato base, pero **con hallazgos de calidad y coherencia** que conviene corregir
- **Severidad global de documentación:** **media**
- **Severidad global de funcionamiento:** **baja** (la API responde bien)

## Veredicto

La API **sí funciona correctamente** en todas las rutas expuestas que fueron probadas.

Sin embargo, la documentación Swagger/OpenAPI **no está totalmente redonda**: hay inconsistencias, ejemplos/servidores desactualizados, una ruta con código documentado distinto al real, una tag declarada pero no usada y la UI de Swagger no está disponible públicamente en el despliegue actual.

---

## 2. Alcance de la auditoría

La auditoría cubrió dos frentes:

### A. Funcionamiento real de la API
Se validó por HTTP real la URL pública para comprobar que:
- las rutas responden
- la autenticación funciona
- el CRUD principal funciona
- mobile funciona
- feedback funciona

### B. Calidad de Swagger/OpenAPI
Se revisó:
- `src/config/swagger.config.ts`
- `src/export-openapi.ts`
- `docs/handoff/ups-expresosapp-openapi.json`
- controladores y DTOs principales
- correspondencia entre lo documentado y lo que realmente responde el backend

---

## 3. Evidencia de funcionamiento real

## Resultado de pruebas endpoint por endpoint

Se ejecutó una prueba integral automática contra la API pública.

### Resultado

- **Total probados:** 40
- **Exitosos:** 40
- **Fallidos:** 0

## Rutas probadas

### Health
- `GET /health`
- `GET /health/db`

### Auth
- `POST /auth/request-code`
- `POST /auth/verify-code`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Admin
- `GET /admin/routes`
- `POST /admin/routes`
- `GET /admin/routes/{id}`
- `PATCH /admin/routes/{id}`
- `PATCH /admin/routes/{id}/stops/order`
- `GET /admin/stops`
- `POST /admin/stops`
- `GET /admin/stops/{id}`
- `PATCH /admin/stops/{id}`
- `GET /admin/schedules`
- `POST /admin/schedules`
- `GET /admin/schedules/{id}`
- `PATCH /admin/schedules/{id}`
- `GET /admin/vehicles`
- `POST /admin/vehicles`
- `GET /admin/vehicles/{id}`
- `PATCH /admin/vehicles/{id}`
- `GET /admin/drivers`
- `POST /admin/drivers`
- `GET /admin/drivers/{id}`
- `PATCH /admin/drivers/{id}`
- `GET /admin/notices`
- `POST /admin/notices`
- `GET /admin/notices/{id}`
- `PATCH /admin/notices/{id}`

### Mobile
- `GET /mobile/routes`
- `GET /mobile/routes/{id}`
- `GET /mobile/routes/{id}/stops`
- `GET /mobile/routes/{id}/schedules`
- `GET /mobile/notices`

### Trip Feedback
- `GET /trip-feedback`
- `POST /trip-feedback`
- `GET /trip-feedback/{id}`

## Conclusión funcional

A nivel de backend puro:
- las rutas **sí están operativas**
- la API **sí responde correctamente**
- la capa auth **sí funciona**
- mobile **sí funciona**
- admin CRUD **sí funciona**

Por tanto, cualquier problema de consumo desde frontend/mobile debe revisarse primero como problema de integración del cliente, salvo en los hallazgos documentales descritos más abajo.

---

## 4. Hallazgos de Swagger/OpenAPI

## Hallazgo 1 — La UI Swagger no está disponible públicamente
**Severidad:** Media

### Evidencia
Se consultó:
- `GET /docs`

Resultado real:
- **404**

### Causa
En la configuración actual de entorno productivo:
- `SWAGGER_ENABLED=false`

### Impacto
- frontend/mobile no puede consultar Swagger UI directamente desde el entorno actualmente expuesto
- el contrato existe en JSON/handoff, pero no está autoexpuesto en runtime

### Recomendación
Elegir una de estas opciones:
1. mantener Swagger deshabilitado públicamente y entregar siempre el OpenAPI JSON + handoff Markdown
2. habilitar Swagger en un entorno interno o staging protegido
3. publicar la especificación OpenAPI como artefacto estático accesible

---

## Hallazgo 2 — Los servers documentados en Swagger están desactualizados
**Severidad:** Media

### Evidencia
En `src/config/swagger.config.ts` y `src/export-openapi.ts` aparecen:
- `http://localhost:3000`
- `https://ups-api-sfq9.onrender.com`
- `https://staging-api.example.com`

### Problema
La API auditada hoy está expuesta en:
- `https://robust-strong-cattle.ngrok-free.app`

Además:
- el servidor actual no corre en `3000` hacia afuera por conflicto local previo
- el server de staging es un placeholder
- Render ya no es el target actual principal según el estado que se está migrando

### Impacto
- frontend/mobile puede tomar URLs incorrectas desde Swagger
- genera confusión operativa
- da imagen de documentación desalineada con despliegue real

### Recomendación
Actualizar los `servers` del OpenAPI para reflejar:
- local real si aplica
- staging real si existe
- producción/entorno actual real
- eliminar placeholders falsos

---

## Hallazgo 3 — Ruta `POST /auth/request-code` documenta mal un código de error
**Severidad:** Alta documental / Baja funcional

### Evidencia documental
En `AuthController`:
- `@ApiForbiddenResponse({ description: 'Email domain not allowed' })`

### Evidencia real
Se probó con un dominio no permitido (`foo@yahoo.com`) y la API respondió:

```json
{
  "statusCode": 400,
  "message": "Email domain is not allowed"
}
```

### Diagnóstico
La documentación dice implícitamente que ese caso es **403**, pero el backend realmente responde **400**.

### Impacto
- el frontend puede mapear mal el error
- QA puede creer que hay un bug cuando en realidad hay una divergencia entre docs y backend
- los consumidores pueden implementar lógica errónea por código HTTP

### Recomendación
Hay que unificar esto. Dos caminos válidos:
1. **corregir la documentación** para que diga 400
2. o cambiar el backend para que efectivamente responda 403 si así lo quieren semánticamente

Mi recomendación práctica: **corregir la documentación a 400**, porque eso es lo que el backend ya hace hoy.

---

## Hallazgo 4 — Existe una tag Swagger declarada pero no usada
**Severidad:** Baja

### Evidencia
Tags configuradas:
- `Users`

Tags realmente usadas por rutas:
- Health
- Auth
- Mobile
- Admin Routes
- Admin Stops
- Admin Schedules
- Admin Vehicles
- Admin Drivers
- Admin Notices
- Trip Feedback

### Problema
`Users` está declarada pero ninguna ruta la usa.

### Impacto
- ruido en Swagger
- apariencia de módulo documentado que en realidad no existe como controller expuesto

### Recomendación
- eliminar la tag `Users` si no existe módulo público asociado
- o crear/documentar rutas reales de users si sí forma parte del roadmap expuesto

---

## Hallazgo 5 — Algunas rutas exitosas no tienen schema 2xx explícito en OpenAPI
**Severidad:** Media

### Rutas afectadas detectadas
- `GET /health`
- `GET /health/db`
- `POST /auth/request-code`
- `POST /auth/logout`
- `PATCH /admin/routes/{id}/stops/order`

### Problema
La ruta está documentada y tiene descripción, pero el response exitoso no siempre declara una estructura JSON explícita completa en OpenAPI.

### Impacto
- herramientas de generación de cliente pueden quedar con tipos pobres o `any`
- frontend pierde autocompletado/confiabilidad del contrato
- QA no ve con exactitud la forma esperada de la respuesta

### Recomendación
Agregar DTOs o schemas explícitos para estos responses, por ejemplo:
- `HealthResponseDto`
- `HealthDbResponseDto`
- `RequestCodeResponseDto`
- `LogoutResponseDto`
- `OrderRouteStopsResponseDto`

---

## Hallazgo 6 — Las rutas Health no documentan errores 4xx/5xx
**Severidad:** Baja

### Evidencia
Las rutas:
- `GET /health`
- `GET /health/db`

no tienen 4xx/5xx relevantes documentados en OpenAPI.

### Impacto
Bajo, pero hace que la documentación sea menos completa para monitoreo y manejo de incidentes.

### Recomendación
Agregar al menos documentación de fallo típico en DB health, por ejemplo 500 si no hay conectividad.

---

## Hallazgo 7 — La documentación de auth y algunos ejemplos siguen muy orientados a correo institucional
**Severidad:** Media

### Evidencia
Los DTOs y ejemplos aún muestran típicamente:
- `student@est.ups.edu.ec`
- correos institucionales

Pero hoy el backend también acepta:
- `gmail.com`

### Impacto
- no rompe el backend
- pero la documentación no comunica bien el estado real del sistema
- puede generar soporte innecesario

### Recomendación
Actualizar ejemplos/documentación textual donde corresponda para reflejar dominios actualmente permitidos.

---

## Hallazgo 8 — Los tests unitarios de auth están desalineados con el comportamiento actual
**Severidad:** Media

### Evidencia
En `src/modules/auth/auth.service.spec.ts` existe un test que espera rechazo para:
- `user@gmail.com`

Pero hoy producción sí permite:
- `gmail.com`

### Impacto
- la documentación del sistema y la intención del código quedan mezcladas con supuestos viejos
- el equipo podría apoyarse en tests que ya no representan la política actual

### Recomendación
Actualizar los tests para que representen el comportamiento vigente.

---

## Hallazgo 9 — La documentación de rutas paginadas vs no paginadas debe dejarse todavía más explícita
**Severidad:** Media

### Contexto real encontrado
Hubo un error real en cliente:

```json
{
  "statusCode": 400,
  "message": ["property limit should not exist"]
}
```

### Causa
El frontend estaba enviando `limit` a una ruta que no es paginada.

### Análisis
El contrato OpenAPI sí diferencia muchas de estas rutas, pero a nivel de integración real conviene remarcarlo aún más en la documentación operativa.

### Impacto
- errores 400 en frontend/mobile
- falsa percepción de backend roto

### Recomendación
Mantener y promover la guía operativa que ya se generó para frontend/mobile, remarcando:
- qué rutas aceptan `page/limit`
- qué rutas no aceptan `page/limit`

---

## 5. Lo que está bien hecho

También hay que dejar claro lo que sí está bien.

## Fortalezas observadas

### 1. Cobertura documental base suficiente
- Las 40 operaciones sí aparecen en OpenAPI
- No faltan summaries
- La mayoría de rutas tiene responses razonables documentados

### 2. DTOs de query y body bien reflejados
- paginación documentada
- filtros documentados
- bodies principales documentados con schemas reutilizables

### 3. Seguridad documentada de manera clara en controladores
- `@ApiBearerAuth()` está bien aplicada en rutas protegidas
- separación entre público y autenticado está bien entendible

### 4. La funcionalidad real sí coincide en gran parte con el contrato
El backend respondió correctamente en todas las rutas auditadas.

### 5. Los módulos principales están suficientemente tipados
- admin CRUD
- auth
- mobile
- trip-feedback

Esto hace que Swagger sea utilizable como base contractual para frontend.

---

## 6. Resultado de calidad por área

| Área | Estado | Comentario |
|---|---|---|
| Funcionamiento real de rutas | Bueno | 40/40 rutas probadas OK |
| Auth backend | Bueno | Flujo OTP/JWT/refresh funciona correctamente |
| OpenAPI cobertura | Buena | Todas las operaciones principales aparecen |
| Exactitud de códigos HTTP documentados | Mejorable | Hay al menos una inconsistencia real (`request-code`) |
| Servers documentados | Deficiente | Están desactualizados/placeholder |
| Swagger UI pública | Deficiente | `/docs` da 404 en el despliegue auditado |
| Calidad de ejemplos | Mejorable | Siguen demasiado amarrados a correos institucionales |
| Coherencia tests vs comportamiento actual | Mejorable | Test de gmail quedó viejo |

---

## 7. Acciones recomendadas en orden prioritario

## Prioridad alta
1. Corregir `POST /auth/request-code` para que la documentación refleje el código HTTP real (`400` en dominio no permitido).
2. Actualizar `servers` en Swagger/OpenAPI para reflejar URLs reales y eliminar placeholders.
3. Documentar con más fuerza qué rutas aceptan `page/limit` y cuáles no.

## Prioridad media
4. Agregar schemas explícitos a responses 2xx que hoy están solo descriptivos.
5. Actualizar ejemplos/documentación para contemplar `gmail.com` si sigue siendo política válida.
6. Corregir tests de auth que todavía asumen rechazo de Gmail.

## Prioridad baja
7. Eliminar la tag `Users` si no se usa.
8. Agregar documentación de errores en health endpoints.
9. Exponer Swagger en un entorno protegido o publicar el OpenAPI JSON de forma más oficial para el equipo cliente.

---

## 8. Veredicto final

## ¿La documentación Swagger está bien hecha?
**Parcialmente sí, pero no está totalmente pulida.**

Está lo bastante bien como para trabajar con frontend/mobile, pero todavía tiene detalles importantes que deben corregirse para que sea una referencia realmente confiable y alineada al despliegue actual.

## ¿Cada ruta está documentada?
**Sí, en términos generales sí.**

Las operaciones principales están cubiertas. Lo que falta mejorar es:
- exactitud fina
- servers reales
- algunos response schemas
- una inconsistencia específica en auth

## ¿Cada ruta funciona correctamente?
**Sí.**

La validación funcional completa dio **40/40 OK**.

---

## 9. Artefactos relevantes de esta auditoría

- Script de prueba endpoint por endpoint:  
  `/home/krionix/ups-api/scripts/test-endpoints.js`

- Guía detallada de rutas para frontend/mobile:  
  `/home/krionix/ups-api/docs/handoff/ROUTES_DETAILED_FRONTEND_MOBILE.md`

- Guía de integración auth frontend:  
  `/home/krionix/ups-api/docs/handoff/AUTH_INTEGRATION_GUIDE_FRONTEND.md`

- Este informe de auditoría:  
  `/home/krionix/ups-api/docs/handoff/SWAGGER_AND_ROUTES_AUDIT_2026-07-09.md`

---

## 10. Conclusión corta para compartir

Si necesitas decirlo en una sola frase al equipo:

> La API está funcionando bien y todas las rutas probadas responden correctamente, pero la documentación Swagger/OpenAPI necesita ajustes de precisión y actualización para alinearse con el despliegue y comportamiento reales.

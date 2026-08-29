# Guía detallada de integración de autenticación para frontend

## Objetivo

Este documento explica, de forma práctica y sin ejemplos de código, cómo debe integrarse el flujo de autenticación de UPS GO desde la app móvil o desde un futuro frontend web.

La meta es que el equipo frontend implemente el login, el manejo de sesión, la renovación de tokens y el cierre de sesión **sin romper el flujo real del backend**.

---

## Resumen ejecutivo

El sistema de autenticación funciona con:

- envío de código OTP por correo
- verificación del código OTP
- entrega de dos credenciales de sesión:
  - **access token**
  - **refresh token**
- renovación controlada de sesión usando el **refresh token**
- revocación de sesión al cerrar sesión o al rotar tokens

### Regla más importante de todo el flujo

El backend **rota el refresh token**.

Eso significa que cada vez que la app renueva sesión:

- recibe un **refresh token nuevo**
- el **refresh token anterior deja de ser válido**

Si el frontend sigue usando el token anterior, el backend responderá con error de sesión inválida o revocada.

---

## Dominios de correo permitidos

El backend permite autenticación para correos cuyos dominios estén dentro de
`ALLOWED_EMAIL_DOMAINS`; los correos explícitos de `SUPER_ADMIN_EMAILS` se
evalúan conforme a la política de backend. Esta configuración pertenece al
entorno y nunca debe codificarse en el cliente.

### Qué debe hacer el frontend con esto

El frontend debe asumir que:

- un correo no permitido será rechazado por backend
- ese rechazo es una validación normal de negocio
- no debe reinterpretarse como fallo general del servidor

Si un usuario escribe un correo fuera de dominio permitido, la app debe mostrar un mensaje claro indicando que ese dominio no está autorizado.

---

## Flujo correcto completo

## 1. Solicitud de código de verificación

### Qué hace esta fase

El usuario escribe su correo y solicita un código OTP.

El backend:

- valida formato del correo
- valida que el dominio esté permitido
- genera un código temporal
- envía el código al correo del usuario
- registra internamente el intento de verificación

### Qué debe hacer el frontend

- pedir al usuario su correo
- enviar la solicitud de código
- si la respuesta es exitosa, mover al usuario a la pantalla de ingreso del OTP
- no asumir que ya existe sesión en este punto
- no crear estado autenticado todavía

### Qué no debe hacer el frontend

- no intentar llamar rutas protegidas todavía
- no guardar sesión todavía
- no asumir que el usuario ya está autenticado solo porque el correo fue aceptado

---

## 2. Verificación del código OTP

### Qué hace esta fase

El usuario ingresa el código que recibió por correo.

Cuando el backend valida ese código correctamente:

- marca el correo como verificado
- crea una sesión nueva
- devuelve:
  - access token
  - refresh token
  - datos básicos del usuario

### Qué debe hacer el frontend

En cuanto reciba una verificación exitosa, debe:

- considerar al usuario autenticado
- guardar de forma segura el **access token**
- guardar de forma segura el **refresh token**
- guardar el objeto de usuario si lo necesita para estado local
- cambiar a la zona autenticada de la app

### Qué debe evitar el frontend

- no mezclar el access token con el refresh token
- no sobrescribir uno con el otro
- no ignorar el refresh token
- no guardar solo el access token

---

## 3. Diferencia entre access token y refresh token

Este punto es crítico.

## Access token

El access token sirve para:

- acceder a rutas protegidas
- identificar al usuario en llamadas autenticadas
- consultar perfil actual
- operar dentro de la app mientras la sesión siga vigente

### Uso correcto del access token

Debe usarse únicamente para autenticación de requests a endpoints protegidos.

### Qué debe entender frontend

- el access token expira
- cuando expire, la app ya no podrá seguir usando ese token para rutas protegidas
- cuando eso ocurra, debe intentar renovar sesión usando el refresh token

---

## Refresh token

El refresh token sirve para:

- pedir un nuevo access token
- pedir un nuevo refresh token
- prolongar la sesión sin obligar al usuario a volver a loguearse

### Uso correcto del refresh token

El refresh token **no se usa como token bearer para navegar la app**.

Su único propósito es renovar la sesión a través del endpoint de refresh.

### Error conceptual muy común

Un frontend mal implementado a veces intenta:

- mandar el refresh token en el header de autorización de rutas protegidas
- tratar el refresh token como si fuera el token normal de acceso

Eso está mal.

---

## 4. Uso de rutas protegidas

Cuando la app quiera consultar información del usuario autenticado o cualquier endpoint protegido, debe:

- tomar el **access token actual**
- enviarlo como credencial de autorización
- nunca usar el refresh token para eso

### Señal de integración correcta

Si el frontend está bien implementado:

- el usuario entra con OTP
- la app obtiene los tokens
- las llamadas autenticadas funcionan con el access token
- si el access token expira, la app renueva sesión correctamente

### Señal de integración incorrecta

Si el frontend usa el token equivocado, suelen aparecer errores como:

- token inválido
- no autorizado
- sesión inválida
- credenciales incorrectas

---

## 5. Renovación de sesión

Este es el punto donde más fácil se rompe el frontend.

## Cómo funciona realmente el backend

Cuando la app solicita renovación de sesión:

- el backend recibe el refresh token actual
- valida que ese refresh token siga perteneciendo a una sesión activa
- genera un **access token nuevo**
- genera un **refresh token nuevo**
- invalida la sesión/token anterior

### Consecuencia práctica

Después de un refresh exitoso, el frontend debe:

- reemplazar el access token anterior
- reemplazar el refresh token anterior
- seguir usando únicamente los nuevos tokens

### Regla crítica

El refresh token anterior **ya no debe volver a usarse**.

Si el frontend lo reutiliza:

- la API responderá indicando que la sesión está expirada o revocada
- eso no significa necesariamente que el backend esté fallando
- normalmente significa que el frontend no actualizó correctamente el almacenamiento local de tokens

---

## 6. Error típico del frontend con refresh token

El problema más probable cuando aparece “token inválido” después de cierto tiempo no es el login inicial, sino el ciclo de refresh.

### Patrón típico del fallo

1. el usuario inicia sesión correctamente
2. la app usa el access token sin problema
3. el access token expira
4. la app llama a refresh
5. el backend devuelve nuevos tokens
6. la app **no reemplaza** correctamente el refresh token viejo
7. más adelante intenta refrescar otra vez con el refresh token viejo
8. el backend responde con sesión revocada o token inválido

### Qué debe hacer el equipo frontend

Deben revisar que, tras cada refresh exitoso:

- el nuevo access token se persista
- el nuevo refresh token se persista
- cualquier request futuro lea el token nuevo, no el viejo
- no exista doble almacenamiento compitiendo entre sí
- no exista memoria temporal con valores viejos

---

## 7. Otro error común: mandar mal la solicitud de refresh

El endpoint de refresh espera que la app le envíe el refresh token en el formato correcto de entrada.

### Qué debe cuidar frontend

- enviar el campo correcto
- enviarlo en el cuerpo correcto de la solicitud
- no renombrarlo arbitrariamente
- no omitirlo
- no intentar usar únicamente headers si el endpoint espera el valor en la carga del request

### Qué suele pasar si frontend se equivoca aquí

El backend responde con error 400 porque:

- falta el refresh token
- el campo tiene otro nombre
- el valor no es string
- el request body no cumple validación

### Cómo debe interpretarse ese 400

Un 400 en refresh no significa automáticamente “backend roto”.

Muchas veces significa simplemente:

- payload incorrecto
- contrato no respetado
- formato distinto al esperado

---

## 8. Manejo correcto de expiración del access token

La app debe tener una estrategia clara para cuando el access token expire.

## Comportamiento esperado

Cuando una llamada autenticada falle porque el access token ya no sirve:

- la app debe intentar renovar sesión
- si la renovación sale bien, repetir la operación original usando el nuevo access token
- si la renovación falla, cerrar sesión localmente y mandar al usuario a autenticarse otra vez

### Qué no debe hacer la app

- no debe entrar en bucles infinitos de refresh
- no debe hacer múltiples refresh simultáneos sin control
- no debe disparar varios refresh en paralelo con el mismo refresh token

### Riesgo importante

Si la app lanza varias renovaciones al mismo tiempo usando el mismo refresh token:

- una puede salir bien
- otra puede intentar reutilizar un token ya invalidado
- eso produce errores de token/sesión que luego se interpretan erróneamente como fallo del backend

### Recomendación operativa para frontend

El mecanismo de refresh debe estar centralizado y serializado.

En otras palabras:

- solo una renovación debe ejecutarse a la vez
- las demás requests deben esperar ese resultado
- cuando el refresh termine, todas deben seguir usando los tokens nuevos

---

## 9. Cierre de sesión

Cuando el usuario cierra sesión:

- la app debe solicitar logout al backend
- la app debe borrar access token local
- la app debe borrar refresh token local
- la app debe limpiar estado del usuario
- la app debe volver al estado de no autenticado

### Qué pasa si frontend no limpia bien

Pueden quedar residuos de sesión como:

- refresh token viejo en almacenamiento
- access token viejo en memoria
- datos de usuario desincronizados

Eso puede generar errores raros al siguiente intento de login.

---

## 10. Qué significa cada familia de errores

## Error 400

Normalmente indica:

- request mal formado
- body inválido
- campo faltante
- campo mal nombrado
- validación de entrada fallida
- dominio de correo no permitido

### Interpretación correcta

Cuando vean 400, lo primero que deben revisar es:

- estructura del payload
- nombres exactos de campos
- tipo de dato enviado
- si están mandando realmente lo que el endpoint espera

---

## Error 401

Normalmente indica:

- access token inválido
- access token expirado
- refresh token inválido
- refresh token ya revocado
- sesión cerrada
- token equivocado usado en un endpoint protegido

### Interpretación correcta

Cuando vean 401, deben revisar:

- si usaron access token o refresh token donde correspondía
- si el token ya expiró
- si el refresh token fue rotado y están reutilizando el viejo
- si hicieron logout antes
- si hubo doble refresh en paralelo

---

## 11. Diagnóstico actual del caso observado

Con las pruebas reales realizadas sobre el backend actual, el comportamiento observado es este:

- request-code funciona correctamente
- verify-code funciona correctamente
- auth/me funciona correctamente con access token válido
- refresh funciona correctamente cuando se usa el refresh token actual
- el refresh token viejo deja de servir después de una renovación exitosa
- logout revoca correctamente la sesión

### Lectura técnica de esto

El backend está respetando su contrato de autenticación.

Por eso, si la app del frontend muestra errores como:

- token inválido
- sesión inválida
- 400 al refrescar

entonces las causas más probables están del lado del frontend, especialmente en:

- almacenamiento de tokens
- reemplazo del refresh token luego del refresh
- estructura del payload en refresh
- uso del token equivocado en headers
- concurrencia de requests de refresh

---

## 12. Checklist para el equipo frontend

El equipo frontend debe revisar, uno por uno, estos puntos:

### Login

- confirmar que después de verify-code se guardan ambos tokens
- confirmar que no se pierde el refresh token
- confirmar que el usuario autenticado entra a estado válido de sesión

### Requests autenticadas

- confirmar que usan access token
- confirmar que no usan refresh token como bearer
- confirmar que el token leído es el más reciente

### Refresh

- confirmar que el refresh token se envía en la forma esperada por el backend
- confirmar que el backend devuelve nuevos tokens
- confirmar que ambos tokens se reemplazan al instante
- confirmar que el refresh token viejo nunca vuelve a reutilizarse

### Persistencia

- confirmar que no existen dos fuentes de verdad para tokens
- confirmar que no hay un token en memoria y otro distinto en almacenamiento persistente
- confirmar que al reabrir la app se usa el token actual y no uno obsoleto

### Concurrencia

- confirmar que no se disparan varios refresh simultáneos
- confirmar que una sola rutina controla la renovación de sesión
- confirmar que las requests pendientes esperan la renovación antes de continuar

### Logout

- confirmar que se limpian access token y refresh token
- confirmar que se limpia el estado del usuario
- confirmar que una nueva sesión no hereda tokens viejos

---

## 13. Recomendación para soporte y debugging

Si el equipo frontend vuelve a reportar que “el backend manda token inválido”, no basta con ese mensaje genérico.

Lo que deben entregar para auditar bien el problema es:

- endpoint exacto al que llamaron
- método HTTP usado
- payload real enviado
- si mandaron header de autorización y con qué tipo de token
- código de estado exacto recibido
- body exacto de la respuesta
- momento del flujo en que pasó:
  - después de login
  - después de refresh
  - después de reabrir la app
  - después de logout

Sin esa evidencia, el error puede parecer “backend roto” cuando en realidad es un problema de manejo de sesión en cliente.

---

## 14. Conclusión final

La integración correcta requiere que el frontend trate la autenticación como un flujo de dos tokens con rotación de refresh token.

La regla más importante que no se puede romper es esta:

> cada vez que el backend devuelva un refresh token nuevo, el frontend debe reemplazar inmediatamente el anterior y dejar de usarlo para siempre.

Si esa regla no se respeta, aparecerán errores de token inválido o sesión revocada aunque el backend esté funcionando correctamente.

---

## Estado operativo actual

El flujo debe validarse contra la configuración activa de cada entorno,
incluidas las cuentas demo locales cuando correspondan. La verificación cubre:

- solicitud de OTP
- verificación de OTP
- acceso autenticado con access token
- refresh exitoso
- revocación del refresh token anterior
- revocación de sesión tras logout

Por tanto, cualquier error restante debe revisarse primero en la implementación del cliente antes de atribuirlo al servidor.

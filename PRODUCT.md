# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

UPS GO sirve a estudiantes de la Universidad Politécnica Salesiana que necesitan consultar el transporte institucional y a conductores que necesitan ejecutar sus servicios asignados. Ambos lo usan principalmente desde el teléfono, cerca de la hora de salida y con conectividad que puede ser inestable.

## Product Purpose

La aplicación conecta la programación oficial del transporte universitario con su ejecución diaria. Para estudiantes, permite encontrar el servicio correcto y conocer su estado real. Para conductores, permite consultar su jornada, iniciar el servicio asignado y finalizarlo sin ambigüedad operativa.

## Positioning

UPS GO no muestra una "ruta activa" genérica: distingue una salida programada de sus asignaciones reales por vehículo y del recorrido que el conductor ha iniciado. Esa separación evita presentar como operación real algo que solo está planificado.

## Operating Context

El estudiante sigue el flujo campus, línea, salida y asignación por bus para consultar una fecha concreta. El conductor ve únicamente sus asignaciones de hoy y, si corresponde, su recorrido en curso. La hora civil de operación es America/Guayaquil y la autoridad de datos es la API de UPS GO.

## Capabilities and Constraints

- Autenticación institucional por OTP existente y sesión protegida con SecureStore.
- Resolución automática de rol: STUDENT y DRIVER tienen flujos distintos; no existe selector manual de rol.
- La app consume los contratos autenticados `/student/*` y `/driver/operational/*` de Fase 6.
- Los estados visibles se limitan a programado, asignado, en recorrido y finalizado según la respuesta del backend.
- No se implementan Admin Web, GPS, ubicación en tiempo real, ETA, notificaciones push, cambio de rol, APK final ni cambios de backend en esta fase.
- Las pantallas nuevas no consumen contratos legacy `/mobile/*` ni crean datos operacionales localmente.

## Brand Commitments

- Nombre visible: UPS GO.
- Identidad universitaria de movilidad sobria, clara y contemporánea.
- Azul principal #07508E, azul marino profundo, acento dorado y blanco.
- Se conservan los recursos gráficos existentes y el fondo de splash actual salvo que una configuración nativa exija reconstruir el cliente.
- La interfaz habla en español claro y evita tecnicismos de dominio cuando no son necesarios para la persona usuaria.

## Evidence on Hand

- Contrato de producto y API: `docs/PHASE_6_FRONTEND_API_CONTRACT.md`.
- Implementación de los contratos: `apps/api/src/modules/operational/operational.service.ts`.
- Recursos actuales: `apps/mobile/assets/images/images_busapp/`.
- No hay diseños, imágenes o requisitos aprobados para tracking GPS, ETA o Admin Web; no se deben inventar.

## Product Principles

1. La autoridad operativa vive en el backend; la app la representa de forma legible.
2. Cada pantalla debe aclarar si algo está programado, asignado o en ejecución.
3. El camino crítico se completa con pocos pasos y sin selección de rol manual.
4. La información sensible de conductores y vehículos se limita a lo que entrega cada contrato.
5. Los estados de carga, vacío, error y desconexión forman parte del producto, no son excepciones visuales.

## Accessibility & Inclusion

La app debe conservar objetivos táctiles amplios, texto legible, etiquetas de accesibilidad, contraste suficiente y navegación compatible con Back/gestos del sistema. Las etiquetas de estado no dependerán solo del color.

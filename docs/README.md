# Documentación de UPS GO

Punto de entrada para quien tenga que mantener, operar o extender la plataforma.
La documentación está separada por superficie del producto:

| Carpeta | Contenido |
|---|---|
| [`api/`](./api/README.md) | Backend NestJS + Prisma + PostgreSQL: arquitectura, dominio, endpoints, configuración, despliegue, pruebas, convenciones. |
| [`app/`](./app/README.md) | Aplicación móvil Expo / React Native (Student y Driver): arquitectura, build y publicación, convenciones, diseño y producto. |
| [`web/`](./web/README.md) | Panel administrativo web: **aún no existe**. Decisiones tomadas, alcance, roadmap y reglas para cuando se construya. |
| [`history/`](./history/README.md) | Informes y revisiones de fases anteriores. Solo referencia histórica. |

Archivo de datos compartido: [`ups_go_routes_reference_guayaquil.json`](./ups_go_routes_reference_guayaquil.json)
es el dataset de referencia (campus, líneas, paradas, horarios) que consumen los seeds y las pruebas.

## Qué es UPS GO

Plataforma institucional para consultar y operar el transporte de la Universidad
Politécnica Salesiana (sedes de Guayaquil). Distingue siempre cinco niveles que
**no son equivalentes**:

```text
ScheduleTime            plantilla horaria recurrente
  → ScheduledDeparture  salida concreta de una fecha
    → ServiceAssignment bus + conductor asignados a esa salida (0..N)
      → ServiceRun      ejecución real iniciada por el conductor
        → posición GPS  (futuro, vía Hunter AVL)
```

Una salida programada no implica un bus en ruta; un bus asignado no implica que
haya iniciado; una posición GPS no define por sí sola el estado operativo.

## Estado actual (resumen)

| Pieza | Estado |
|---|---|
| App móvil Student + Driver | Funcional. Sin QA físico en iOS. |
| Autenticación OTP por correo | Funcional. |
| API de operación (Student/Driver/Admin) | Funcional. |
| API de administración de horarios (25 operaciones) | Funcional. |
| Despliegue de la API con Docker | Listo (`docker-compose.yml` en la raíz). |
| Panel administrativo web | No construido. |
| GPS / tiempo real / ETA / notificaciones push | No implementados. Proveedor previsto: Hunter AVL (ver [`api/tracking-hunter.md`](./api/tracking-hunter.md)). |

## Estructura del repositorio

```text
apps/api      Backend NestJS (pnpm)
apps/mobile   App Expo / React Native (npm)
docs          Esta documentación
scripts       Utilidades de desarrollo local (dev-stack.sh)
docker-compose.yml   Despliegue de la API (PostgreSQL + migraciones + API)
```

## Reglas transversales

1. **Una sola fuente de verdad por dato.** El backend es la autoridad de estados,
   roles y propiedad; las apps nunca los recalculan.
2. **Contrato primero.** DTOs NestJS → OpenAPI → tipos generados en la app. El archivo generado
   no se edita a mano.
3. **Cambios de base de datos solo con migraciones** versionadas (nunca `db push`).
4. **Nada de secretos en el repositorio.** Solo `.env.example` con placeholders.
5. **Cada cambio pasa los gates** de su superficie antes de integrarse (ver `api/testing.md` y
   `app/conventions.md`).
6. **Ramas y PR.** No se trabaja directo en `main`; commits pequeños y descriptivos.

# UPS GO — Handoff vigente

Los handoffs estáticos del dominio legacy fueron retirados con Fase 8 para no
competir con el contrato operativo actual. La fuente de verdad es:

```text
DTOs NestJS → OpenAPI generado → apps/mobile/src/api/generated/openapi.ts
```

Genera y verifica el contrato desde `apps/api` con:

```bash
pnpm generate:mobile-contracts
pnpm verify:mobile-contracts
```

`AUTH_FLOW.md` y `AUTH_INTEGRATION_GUIDE_FRONTEND.md` se conservan como apoyo
al flujo de autenticación. Student y Driver consumen únicamente las rutas
operativas documentadas por Swagger; Admin Web no está iniciado.

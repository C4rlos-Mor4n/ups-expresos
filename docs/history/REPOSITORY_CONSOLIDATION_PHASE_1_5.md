# UPS EXPRESOS — REPOSITORY CONSOLIDATION REPORT

Fecha: 2026-08-19

## Before

```text
Workspace:          /home/cmoran/ups-expreso
Backend:            /home/cmoran/ups-expreso/ups-api
Mobile:             /home/cmoran/ups-expreso/ups-expresos-mobile
Backend Git SHA:    N/A (historial eliminado por decisión del propietario)
Backend branch:     N/A
Backend remote:     N/A
Mobile Git:         N/A (nunca tuvo .git)
```

> Nota de historial: el repositorio Git del backend (`ups-api/.git`) ya no existía al inicio de esta fase. El propietario lo eliminó y autorizó explícitamente iniciar desde cero. Por tanto se creó un repositorio nuevo en el workspace consolidado.

## After

```text
Workspace:          /home/cmoran/ups-expresos
Repository:         C4rlos-Mor4n/ups-expresos
Structure:          apps/api, apps/mobile
Branch:             main
Origin:             https://github.com/C4rlos-Mor4n/ups-expresos.git
```

## Git History

```text
Backend history preserved:      NO (propietario eliminó el .git; iniciado desde cero por decisión explícita)
Original baseline SHA reachable: NO (no existía .git al inicio; no aplicable)
```

Resultado: repositorio nuevo con un único commit de consolidación (`chore(repo): consolidate api and mobile into unified repository`).

## Security

```text
Repository visibility:     PUBLIC
.env tracked:              NO (solo apps/api/.env.example con placeholders seguros)
Secrets detected:          NO
Historical secrets detected: N/A (no existe historial previo; repo iniciado desde cero)
Keys/certificates tracked: NO
node_modules tracked:      NO
Build artifacts tracked:   NO
```

No se incluyó ningún valor secreto en este reporte.

## Gitignore

- Se creó `.gitignore` raíz que cubre ambos proyectos: `**/.env`, `**/.env.*` (con excepción `!**/.env.example`), `**/node_modules/`, `**/dist/`, `**/build/`, `**/coverage/`, `.expo/`, `web-build/`, `expo-env.d.ts`, `*.tsbuildinfo`, certificados/keys/credenciales (`*.pem`, `*.key`, `*.p12`, `*.p8`, `*.jks`, `*.keystore`, `*.mobileprovision`, `service-account*.json`, `credentials*.json`, `secrets*.json`, `.npmrc`), `google-services.json`, `GoogleService-Info.plist`, logs, OS, IDE.
- Se conservaron los `.gitignore` específicos de `apps/api/` y `apps/mobile/` (reglas propias de cada subproyecto).
- Excepción mantenida: `apps/api/.env.example` (versionado, contiene solo placeholders seguros).

## Files moved

```text
ups-api  → apps/api       (backend NestJS + Prisma + PostgreSQL)
ups-expresos-mobile → apps/mobile  (aplicación Expo / React Native)
```

- Raíz: `.gitignore`, `README.md`, `docs/`.
- No se movió documentación interna a `docs/` raíz: `apps/api/docs` permanece en API y `apps/mobile/docs` permanece en mobile.

## Functional Changes

```text
NONE
```

- Backend: solo se normalizó `package.json#name` de `ups-api` a `ups-expresos-api` (puramente técnico, no rompe nada). No se tocaron endpoints, Swagger, DTOs, Prisma, migraciones, servicios ni auth.
- Mobile: sin cambios funcionales. No se corrigieron hallazgos de la auditoría Fase 1.
- Identidad Expo preservada (name `UPS Expresos`, slug `ups-expresos-mobile`, EAS projectId, bundle ids).

## Validation

### API

```text
Install:   PASS (pnpm install --frozen-lockfile)
Lint:      PASS (eslint)
Typecheck: PASS (tsc --noEmit)
Build:     PASS (nest build)
Tests:     PASS (12 suites, 97 tests)
```

Backend behavior: UNCHANGED tras el movimiento.

### Mobile

```text
Install:      PASS (npm ci)
Typecheck:    FAIL (2 errores pre-existentes de Fase 1: animated-icon.web.tsx CSS module + theme.ts global.css)
Expo config:  PASS
Expo Doctor:  FAIL (2 checks pre-existentes de Fase 1: Hermes V1 regression + packages version)
```

Comparación contra Fase 1:

```text
PRE-EXISTING FAILURE: Typecheck FAIL (2), Expo Doctor FAIL (2) — idénticos a Fase 1
NEW REGRESSION:       NONE (ningún error nuevo por el movimiento; expo config y build de paths intactos)
```

## GitHub

```text
Remote configured: YES (origin → https://github.com/C4rlos-Mor4n/ups-expresos.git)
Push:              PASS
Force push:        NO
```

Remote verificado antes del push: vacío (sin commits). Push sin `--force`.

---

## GO / NO-GO

```text
Status: GO (con nota de historial)
```

- Estructura correcta: `/home/cmoran/ups-expresos/{.git,.gitignore,README.md,apps/{api,mobile},docs}`.
- Único `.git` en la raíz.
- Sin `.env` tracked, sin secretos, sin keys/certificados, sin node_modules ni artifacts en el repo.
- Security Publication Gate: PASS.
- Nota: el historial del backend NO se preservó porque el propietario lo eliminó y autorizó partir de cero. Esta decisión fue explícita del propietario del repositorio.

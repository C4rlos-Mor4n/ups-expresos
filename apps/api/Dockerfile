# syntax=docker/dockerfile:1.7
#
# UPS GO API — imagen de producción.
#
# Contexto de build: apps/api (ver docker-compose.yml en la raíz del repo).
# La imagen conserva todas las dependencias (incluida la CLI de Prisma) para
# poder ejecutar `prisma migrate deploy` y los seeds desde el mismo artefacto.

ARG NODE_VERSION=20

# ── Base: Node + OpenSSL (requerido por el motor de Prisma) + pnpm ─────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@10.34.5 --activate
WORKDIR /app

# ── Build: dependencias, cliente Prisma y compilación TypeScript ───────────────
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# `prisma generate` no abre conexión; la URL solo debe existir para cargar la config.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" pnpm prisma generate \
    && pnpm build

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts /app/package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]

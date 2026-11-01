# Imagen de producción: un solo servicio que sirve la API (/api/v1, /swagger) y el frontend (PWA).
# Railway la construye desde la raíz del repo (ver railway.json y docs/DEPLOY-RAILWAY.md).

# ---------- 1. Frontend (Vite) ----------
FROM oven/bun:1.4.2 AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
# Railway pasa las variables del servicio como build args si se declaran aquí
ARG ENABLE_STORE_SIMULATOR=false
ENV VITE_STORE_SIMULATOR=${ENABLE_STORE_SIMULATOR}
RUN bun run build

# ---------- 2. Dependencias del backend ----------
FROM oven/bun:1.4.2 AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile --production

# ---------- 3. Runtime ----------
FROM oven/bun:1.4.2
WORKDIR /app/backend
ENV NODE_ENV=production \
    FRONTEND_DIST=/app/frontend/dist \
    PORT=3000
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/package.json backend/tsconfig.json ./
COPY backend/src ./src
COPY --from=frontend /app/frontend/dist /app/frontend/dist
USER bun
EXPOSE 3000
CMD ["bun", "src/index.ts"]

# ── Stage 1: build del frontend (React + Vite) ───────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Instala dependencias primero (capa cacheada si package.json no cambia)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copia el código fuente y construye
COPY index.html vite.config.js ./
COPY public/ ./public/
COPY src/ ./src/
RUN npm run build

# ── Stage 2: runtime (Express sirve API + estáticos) ─────────────
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Solo las dependencias de producción
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Código del servidor
COPY server/ ./server/

# Build del frontend generado en stage 1
COPY --from=builder /app/dist ./dist

# Volumen para persistir la base de datos SQLite
VOLUME ["/app/server/data"]

EXPOSE 3001

CMD ["node", "server/index.js"]

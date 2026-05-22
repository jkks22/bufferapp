# ── Stage 1: build del frontend (React + Vite) ───────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY index.html vite.config.js ./
COPY public/ ./public/
COPY src/ ./src/
RUN npm run build

# ── Stage 2: runtime (Express sirve API + estáticos) ─────────────
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Instala herramientas de compilación necesarias para better-sqlite3,
# compila las dependencias de producción y las limpia en una sola capa
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && apk del make g++

COPY server/ ./server/
COPY --from=builder /app/dist ./dist

VOLUME ["/app/server/data"]

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]

# BufferApp

PWA para optimizar el uso de ancho de banda en conexiones débiles u offline. Guarda páginas web y archivos localmente, predice qué contenido pre-descargar según tu historial y sincroniza acciones cuando vuelve la conexión.

## Características

- **Caché de páginas** — descarga y comprime HTML con LZ-String (~60–80% menos espacio)
- **Caché de archivos** — arrastra y suelta PDFs, imágenes, videos, documentos
- **Monitor de señal** — detecta fuerza de conexión en tiempo real (0–4 barras)
- **Cola de sincronización** — acumula acciones offline y las reenvía al recuperar conexión (máx 3 reintentos)
- **Predictor inteligente** — analiza el historial para sugerir qué pre-descargar y a qué horas
- **PWA instalable** — Service Worker propio, funciona offline, instalable en cualquier dispositivo

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│  React 19  (Vite 8)                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Dashboard │  │CachePage │  │   QueuePage      │   │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │                 │              │
│  ┌────▼──────────────▼─────────────────▼──────────┐  │
│  │  useNetwork  useSync  usePredictor  usePWA...  │  │
│  └────────────────────────┬───────────────────────┘  │
│                           │                          │
│  ┌────────────────────────▼───────────────────────┐  │
│  │  lib/db.js (Dexie / IndexedDB)                 │  │
│  │  cacheManager · queueManager · usageLogger     │  │
│  └────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │  lib/predictor.js                               │  │
│  │  getSuggestions · autoPrefetch · logAccess      │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
              ↕ /api  (proxy en dev)
┌─────────────────────────────────────────────────────┐
│  Express 5  (server/)                                │
│  GET  /api/health                                    │
│  POST /api/messages  ·  GET /api/messages/:roomId    │
│  POST /api/demo                                      │
└─────────────────────────────────────────────────────┘
```

## Requisitos

- Node.js 18+
- npm 9+

## Instalación

```bash
git clone <repo>
cd bufferapp
npm install
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el frontend (Vite, puerto 5173) |
| `npm run dev:server` | Inicia el backend Express (puerto 3001) |
| `npm run dev:all` | Frontend + backend en paralelo |
| `npm run build` | Compila para producción |
| `npm run preview` | Previsualiza el build |
| `npm test` | Tests en modo watch (Vitest) |
| `npm run test:run` | Tests una sola vez |
| `npm run test:coverage` | Tests con reporte de cobertura |

## Uso en desarrollo

```bash
# Frontend + backend juntos
npm run dev:all

# O por separado:
npm run dev         # frontend en :5173
npm run dev:server  # backend en :3001
```

El proxy de Vite redirige `/api/*` → `http://localhost:3001`, sin problemas de CORS.

## Estructura del proyecto

```
bufferapp/
├── public/
│   ├── sw.js              # Service Worker (caché offline)
│   ├── manifest.json      # Web App Manifest (PWA)
│   └── icons/             # Iconos 192x192 y 512x512
├── server/
│   ├── app.js             # Express app (sin listen)
│   ├── index.js           # Punto de entrada del servidor
│   ├── routes/
│   │   ├── health.js
│   │   ├── messages.js
│   │   └── demo.js
│   └── middleware/
│       ├── errorHandler.js
│       └── notFound.js
└── src/
    ├── lib/
    │   ├── db.js           # Dexie — cacheManager, queueManager, usageLogger
    │   └── predictor.js    # Lógica predictiva de caché
    ├── hooks/
    │   ├── useNetwork.js   # Estado de red en tiempo real
    │   ├── useSync.js      # Sincronización de cola offline
    │   ├── usePredictor.js # Sugerencias y pre-descarga
    │   └── usePWAInstall.js# Prompt de instalación PWA
    ├── components/
    │   ├── Layout.jsx      # Network bar + bottom nav
    │   ├── InstallBanner.jsx
    │   └── UpdatePrompt.jsx
    └── pages/
        ├── Dashboard.jsx   # Stats, señal, predictor
        ├── CachePage.jsx   # Caché de páginas y archivos
        └── QueuePage.jsx   # Cola de sincronización
```

## API del backend

### `GET /api/health`
```json
{ "status": "ok", "uptime": 12.3, "timestamp": "2026-03-27T..." }
```

### `POST /api/messages`
Cuerpo:
```json
{ "roomId": "general", "content": "Hola", "author": "usuario" }
```
Respuesta `201`:
```json
{ "id": "uuid", "roomId": "general", "content": "Hola", "synced": true }
```

### `GET /api/messages/:roomId`
Respuesta `200`: array de mensajes de esa sala.

### `POST /api/demo`
Endpoint de prueba. Cuerpo: `{ "message": "...", "ts": 123 }`.

> **Nota:** El backend usa almacenamiento en memoria (se reinicia con el servidor). Para producción, reemplazar con una base de datos real.

## PWA y Service Worker

El Service Worker en `public/sw.js` implementa:

- **Cache First** para assets del app shell (JS, CSS, fuentes, imágenes)
- **Network First** para el proxy de allorigins y cualquier otra petición
- **Network Only** para `/api/*` (nunca cachear respuestas de la API)
- Limpieza automática de caches antiguas al activarse

Para instalar: Chrome/Edge muestran el botón automáticamente. En iOS usar "Añadir a pantalla de inicio" desde Safari.

> **Nota:** El SW no funciona en modo dev. Para probarlo: `npm run build && npm run preview`.

## Tests

```bash
npm test            # modo watch
npm run test:run    # una sola vez
npm run test:coverage
```

57 tests cubren:
- `lib/db.js` — cacheManager, queueManager, usageLogger
- `lib/predictor.js` — getSuggestions, getWeakSignalHours, shouldPrefetch, logAccess, autoPrefetch
- `hooks/useNetwork.js` — estados iniciales, eventos online/offline, cálculo de señal
- `hooks/useSync.js` — procesamiento de cola, reintentos, tipos HTTP_REQUEST y SEND_MESSAGE
- `hooks/usePredictor.js` — carga de sugerencias, auto pre-descarga, formatHour

Stack: Vitest + jsdom + @testing-library/react + fake-indexeddb

## Decisiones técnicas

| Decisión | Razón |
|----------|-------|
| **Dexie** sobre localStorage | Soporte de consultas, índices, transacciones y almacenamiento de binarios |
| **LZ-String** para compresión | Sin dependencias nativas, funciona en el browser, reduce ~60–80% en HTML |
| **Vitest** sobre Jest | Reutiliza la config de Vite, sin transpilación extra, 5-10x más rápido en cold start |
| **Express** para el backend | Proyecto ya es ESM, Express 5 lo soporta nativamente; suficiente para la cola |
| **SW manual** vs vite-plugin-pwa | vite-plugin-pwa no soporta Vite 8 aún |
| **fake-indexeddb** en tests | jsdom no implementa IndexedDB; es el mock estándar para Dexie |

// CACHE_VERSION se inyecta en build; en dev usa timestamp para forzar refresh
const CACHE_VERSION = self.__CACHE_VERSION__ || Date.now()
const CACHE_NAME = `bufferapp-v${CACHE_VERSION}`

const PRECACHE_ASSETS = ['/', '/index.html', '/offline.html']

// ── Install ────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(PRECACHE_ASSETS).catch(() => cache.add('/'))
    )
  )
  self.skipWaiting()
})

// ── Activate: limpia caches de versiones anteriores ───────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // API del backend → Network Only (nunca cachear), excepto el proxy de páginas
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/proxy')) return

  // Proxy de allorigins → Network First con fallback de caché
  if (url.hostname === 'api.allorigins.win') {
    event.respondWith(networkFirst(request))
    return
  }

  // Assets del app shell (JS, CSS, HTML, fuentes, imágenes) → Cache First
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'document' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(networkFirst(request))
})

// ── Estrategias ───────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    if (request.destination === 'document') {
      return caches.match('/offline.html') || offlineFallback()
    }
    return offlineFallback()
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.destination === 'document') {
      return caches.match('/offline.html') || offlineFallback()
    }
    return offlineFallback()
  }
}

function offlineFallback() {
  return new Response(
    '<!doctype html><html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f0f;color:#f0f0f0"><div style="text-align:center"><h1>Sin conexión</h1><p>Abre BufferApp cuando tengas señal.</p></div></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html' } }
  )
}

// ── Background Sync ───────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(notifyClientsToSync())
  }
})

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
  clients.forEach(client => client.postMessage({ type: 'SW_SYNC_QUEUE' }))
}

// ── Mensajes desde el cliente ─────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

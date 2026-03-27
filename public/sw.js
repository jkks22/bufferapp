const CACHE_NAME = 'bufferapp-v1'

// Assets que se precargan al instalar el SW
const PRECACHE_ASSETS = ['/', '/index.html']

// ── Install: precachea el shell de la app ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: limpia caches antiguas ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: estrategia por tipo de request ─────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // API del backend → Network Only (nunca cachear)
  if (url.pathname.startsWith('/api/')) return

  // Proxy de allorigins → Network First con fallback de caché
  if (url.hostname === 'api.allorigins.win') {
    event.respondWith(networkFirst(request))
    return
  }

  // Assets del app shell (JS, CSS, HTML) → Cache First
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

  // Resto → Network First
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
    return new Response('Sin conexión', { status: 503 })
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
    return cached || new Response('Sin conexión', { status: 503 })
  }
}

// ── Mensajes desde el cliente ─────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

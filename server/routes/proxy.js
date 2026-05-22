import { Router } from 'express'

const router = Router()

// Rangos de IP privadas que no deben ser alcanzables (protección SSRF)
const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.0\.0\.0)/i

function isBlockedHost(hostname) {
  return BLOCKED_HOSTS.test(hostname)
}

// GET /api/proxy?url=https://example.com
router.get('/', async (req, res) => {
  const raw = req.query.url

  if (!raw) {
    return res.status(400).json({ error: 'Falta el parámetro url' })
  }

  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    return res.status(400).json({ error: 'URL inválida' })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Solo se permiten URLs http/https' })
  }

  if (isBlockedHost(parsed.hostname)) {
    return res.status(403).json({ error: 'URL no permitida' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const upstream = await fetch(parsed.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BufferApp/1.0; +https://github.com/bufferapp)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!upstream.ok) {
      return res.status(502).json({ error: `El servidor remoto devolvió ${upstream.status}` })
    }

    const contentType = upstream.headers.get('content-type') || 'text/html'

    // Solo permitir tipos de contenido útiles para cachear
    if (!contentType.includes('html') && !contentType.includes('text')) {
      return res.status(415).json({ error: 'Tipo de contenido no soportado para caché' })
    }

    const html = await upstream.text()

    res
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('X-Proxied-From', parsed.hostname)
      .set('Cache-Control', 'no-store')
      .send(html)
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'La petición tardó demasiado (>15s)' })
    }
    return res.status(502).json({ error: 'No se pudo alcanzar el servidor remoto' })
  }
})

export default router

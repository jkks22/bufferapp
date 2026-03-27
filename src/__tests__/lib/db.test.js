import { describe, it, expect, beforeEach } from 'vitest'
import { db, cacheManager, queueManager, usageLogger } from '../../lib/db'

beforeEach(async () => {
  await db.pages.clear()
  await db.files.clear()
  await db.apiCache.clear()
  await db.syncQueue.clear()
  await db.usageLog.clear()
})

// ──────────────────────────────────────────
// cacheManager
// ──────────────────────────────────────────

describe('cacheManager.savePage', () => {
  it('guarda la página y devuelve métricas de compresión', async () => {
    const html = '<html><body>' + 'a'.repeat(1000) + '</body></html>'
    const result = await cacheManager.savePage('https://example.com', html, 'Test')
    expect(result.size).toBeGreaterThan(0)
    expect(result.originalSize).toBeGreaterThan(result.size)
    expect(result.ratio).toBeGreaterThan(0)
  })

  it('almacena el flag compressed en true', async () => {
    await cacheManager.savePage('https://example.com', '<html/>', 'Test')
    const raw = await db.pages.get('https://example.com')
    expect(raw.compressed).toBe(true)
  })
})

describe('cacheManager.getPage', () => {
  it('devuelve null para URL inexistente', async () => {
    const result = await cacheManager.getPage('https://no-existe.com')
    expect(result).toBeNull()
  })

  it('descomprime el HTML al leer', async () => {
    const original = '<html><body>Hola Mundo</body></html>'
    await cacheManager.savePage('https://example.com', original, 'Test')
    const page = await cacheManager.getPage('https://example.com')
    expect(page.html).toBe(original)
  })
})

describe('cacheManager.deletePage', () => {
  it('elimina la página de la base de datos', async () => {
    await cacheManager.savePage('https://example.com', '<html/>', 'Test')
    await cacheManager.deletePage('https://example.com')
    const result = await cacheManager.getPage('https://example.com')
    expect(result).toBeNull()
  })
})

describe('cacheManager.getApiResponse', () => {
  it('devuelve null para URL inexistente', async () => {
    const result = await cacheManager.getApiResponse('https://api.com/test')
    expect(result).toBeNull()
  })

  it('devuelve los datos si no han expirado', async () => {
    const data = { foo: 'bar' }
    await cacheManager.saveApiResponse('https://api.com/test', data, 3600)
    const result = await cacheManager.getApiResponse('https://api.com/test')
    expect(result).toEqual(data)
  })

  it('devuelve null y borra entrada si el TTL expiró', async () => {
    await cacheManager.saveApiResponse('https://api.com/old', { x: 1 }, -1)
    const result = await cacheManager.getApiResponse('https://api.com/old')
    expect(result).toBeNull()
    const raw = await db.apiCache.get('https://api.com/old')
    expect(raw).toBeUndefined()
  })
})

describe('cacheManager.getCompressionStats', () => {
  it('devuelve ratio 0 cuando no hay páginas', async () => {
    const stats = await cacheManager.getCompressionStats()
    expect(stats.ratio).toBe(0)
  })

  it('calcula ratio positivo cuando hay páginas comprimidas', async () => {
    const html = '<html><body>' + 'texto repetido '.repeat(200) + '</body></html>'
    await cacheManager.savePage('https://example.com', html, 'Test')
    const stats = await cacheManager.getCompressionStats()
    expect(stats.ratio).toBeGreaterThan(0)
    expect(stats.totalOriginal).toBeGreaterThan(stats.totalCompressed)
  })
})

describe('cacheManager.getTotalSize', () => {
  it('devuelve 0 cuando no hay datos', async () => {
    const size = await cacheManager.getTotalSize()
    expect(size).toBe(0)
  })

  it('suma el tamaño de páginas guardadas', async () => {
    await cacheManager.savePage('https://example.com', '<html/>', 'Test')
    const size = await cacheManager.getTotalSize()
    expect(size).toBeGreaterThan(0)
  })
})

// ──────────────────────────────────────────
// queueManager
// ──────────────────────────────────────────

describe('queueManager', () => {
  it('enqueue incrementa el count', async () => {
    await queueManager.enqueue('HTTP_REQUEST', { url: 'https://api.com' })
    expect(await queueManager.count()).toBe(1)
    await queueManager.enqueue('SEND_MESSAGE', { content: 'hola' })
    expect(await queueManager.count()).toBe(2)
  })

  it('dequeue elimina el item por id', async () => {
    await queueManager.enqueue('HTTP_REQUEST', { url: 'https://api.com' })
    const [item] = await queueManager.getQueue()
    await queueManager.dequeue(item.id)
    expect(await queueManager.count()).toBe(0)
  })

  it('incrementRetries suma 1 al campo retries', async () => {
    await queueManager.enqueue('HTTP_REQUEST', { url: 'https://api.com' })
    const [item] = await queueManager.getQueue()
    expect(item.retries).toBe(0)
    await queueManager.incrementRetries(item.id)
    const [updated] = await queueManager.getQueue()
    expect(updated.retries).toBe(1)
  })

  it('getQueue devuelve los items ordenados por createdAt', async () => {
    await queueManager.enqueue('HTTP_REQUEST', { url: 'https://primero.com' })
    await queueManager.enqueue('SEND_MESSAGE', { content: 'segundo' })
    const queue = await queueManager.getQueue()
    expect(queue.length).toBe(2)
    expect(queue[0].payload.url).toBe('https://primero.com')
  })
})

// ──────────────────────────────────────────
// usageLogger
// ──────────────────────────────────────────

describe('usageLogger', () => {
  it('log agrega una entrada al historial', async () => {
    await usageLogger.log('https://example.com', 'page', 1)
    const all = await db.usageLog.toArray()
    expect(all.length).toBe(1)
    expect(all[0].resourceId).toBe('https://example.com')
  })

  it('getMostAccessedOnWeakSignal filtra por signalStrength <= 1', async () => {
    await usageLogger.log('https://a.com', 'page', 0)
    await usageLogger.log('https://a.com', 'page', 1)
    await usageLogger.log('https://b.com', 'page', 3) // señal buena — no debe contar
    const result = await usageLogger.getMostAccessedOnWeakSignal()
    expect(result).toHaveLength(1)
    expect(result[0].resourceId).toBe('https://a.com')
    expect(result[0].count).toBe(2)
  })

  it('getMostAccessedOnWeakSignal ordena por count descendente', async () => {
    await usageLogger.log('https://a.com', 'page', 1)
    await usageLogger.log('https://b.com', 'page', 0)
    await usageLogger.log('https://b.com', 'page', 1)
    const result = await usageLogger.getMostAccessedOnWeakSignal()
    expect(result[0].resourceId).toBe('https://b.com')
    expect(result[0].count).toBe(2)
  })
})

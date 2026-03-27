import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../lib/db'
import { predictor } from '../../lib/predictor'

beforeEach(async () => {
  await db.usageLog.clear()
  await db.pages.clear()
})

describe('predictor.getSuggestions', () => {
  it('devuelve array vacío cuando no hay logs', async () => {
    const result = await predictor.getSuggestions()
    expect(result).toEqual([])
  })

  it('solo cuenta accesos con signalStrength <= 1', async () => {
    await db.usageLog.bulkAdd([
      { resourceId: 'https://a.com', resourceType: 'page', accessedAt: Date.now(), signalStrength: 0 },
      { resourceId: 'https://a.com', resourceType: 'page', accessedAt: Date.now(), signalStrength: 4 }, // buena señal — no cuenta
      { resourceId: 'https://b.com', resourceType: 'page', accessedAt: Date.now(), signalStrength: 3 }, // no cuenta
    ])
    const result = await predictor.getSuggestions()
    expect(result).toHaveLength(1)
    expect(result[0].resourceId).toBe('https://a.com')
  })

  it('agrupa por resourceId y ordena por count descendente', async () => {
    await db.usageLog.bulkAdd([
      { resourceId: 'https://b.com', resourceType: 'page', accessedAt: Date.now(), signalStrength: 1 },
      { resourceId: 'https://b.com', resourceType: 'page', accessedAt: Date.now(), signalStrength: 0 },
      { resourceId: 'https://a.com', resourceType: 'page', accessedAt: Date.now(), signalStrength: 1 },
    ])
    const result = await predictor.getSuggestions()
    expect(result[0].resourceId).toBe('https://b.com')
    expect(result[0].count).toBe(2)
    expect(result[1].resourceId).toBe('https://a.com')
    expect(result[1].count).toBe(1)
  })

  it('devuelve máximo 5 sugerencias', async () => {
    const logs = Array.from({ length: 10 }, (_, i) => ({
      resourceId: `https://site${i}.com`,
      resourceType: 'page',
      accessedAt: Date.now(),
      signalStrength: 0
    }))
    await db.usageLog.bulkAdd(logs)
    const result = await predictor.getSuggestions()
    expect(result.length).toBeLessThanOrEqual(5)
  })
})

describe('predictor.getWeakSignalHours', () => {
  it('devuelve array vacío cuando no hay logs con señal débil', async () => {
    await db.usageLog.add({ resourceId: 'https://a.com', resourceType: 'page', accessedAt: Date.now(), signalStrength: 4 })
    const result = await predictor.getWeakSignalHours()
    expect(result).toEqual([])
  })

  it('devuelve las horas con más accesos sin señal', async () => {
    const hora8 = new Date()
    hora8.setHours(8, 0, 0, 0)
    const hora20 = new Date()
    hora20.setHours(20, 0, 0, 0)

    await db.usageLog.bulkAdd([
      { resourceId: 'https://a.com', resourceType: 'page', accessedAt: hora8.getTime(), signalStrength: 0 },
      { resourceId: 'https://a.com', resourceType: 'page', accessedAt: hora8.getTime(), signalStrength: 1 },
      { resourceId: 'https://b.com', resourceType: 'page', accessedAt: hora20.getTime(), signalStrength: 0 },
    ])
    const result = await predictor.getWeakSignalHours()
    expect(result[0].hour).toBe(8)
    expect(result[0].count).toBe(2)
  })

  it('devuelve máximo 3 horas', async () => {
    const logs = [0, 1, 2, 3, 4].map(h => {
      const d = new Date()
      d.setHours(h, 0, 0, 0)
      return { resourceId: `https://site.com`, resourceType: 'page', accessedAt: d.getTime(), signalStrength: 0 }
    })
    await db.usageLog.bulkAdd(logs)
    const result = await predictor.getWeakSignalHours()
    expect(result.length).toBeLessThanOrEqual(3)
  })
})

describe('predictor.shouldPrefetch', () => {
  it('devuelve true para señal >= 3', () => {
    expect(predictor.shouldPrefetch(3)).toBe(true)
    expect(predictor.shouldPrefetch(4)).toBe(true)
  })

  it('devuelve false para señal <= 2', () => {
    expect(predictor.shouldPrefetch(0)).toBe(false)
    expect(predictor.shouldPrefetch(1)).toBe(false)
    expect(predictor.shouldPrefetch(2)).toBe(false)
  })
})

describe('predictor.logAccess', () => {
  it('registra el acceso en usageLog', async () => {
    await predictor.logAccess('https://example.com', 'page', 2)
    const logs = await db.usageLog.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0].resourceId).toBe('https://example.com')
    expect(logs[0].signalStrength).toBe(2)
  })

  it('elimina logs con más de 30 días', async () => {
    const masde30dias = Date.now() - 31 * 24 * 60 * 60 * 1000
    await db.usageLog.add({ resourceId: 'https://viejo.com', resourceType: 'page', accessedAt: masde30dias, signalStrength: 0 })
    await predictor.logAccess('https://nuevo.com', 'page', 1)
    const logs = await db.usageLog.toArray()
    const viejo = logs.find(l => l.resourceId === 'https://viejo.com')
    expect(viejo).toBeUndefined()
  })
})

describe('predictor.autoPrefetch', () => {
  it('no hace nada si shouldPrefetch es false', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await predictor.autoPrefetch(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
    vi.unstubAllGlobals()
  })

  it('no pre-descarga páginas que ya están en caché', async () => {
    await db.usageLog.add({ resourceId: 'https://example.com', resourceType: 'page', accessedAt: Date.now(), signalStrength: 0 })
    await db.pages.put({ id: 'https://example.com', title: 'Test', html: 'x', compressed: false, size: 1, originalSize: 1, cachedAt: Date.now(), status: 'cached' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await predictor.autoPrefetch(4)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
    vi.unstubAllGlobals()
  })
})

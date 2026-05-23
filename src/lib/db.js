import Dexie from 'dexie'
import LZString from 'lz-string'

export const db = new Dexie('BufferAppDB')

db.version(1).stores({
  pages: 'id, title, cachedAt, size, status',
  files: '++id, name, type, size, cachedAt, status',
  messages: '++id, roomId, content, author, createdAt, synced',
  apiCache: 'id, data, cachedAt, expiresAt, status',
  syncQueue: '++id, type, payload, createdAt, retries',
  usageLog: '++id, resourceId, resourceType, accessedAt, signalStrength',
})

// v2: agrega índice serverId a messages para deduplicar al sincronizar con el servidor
db.version(2).stores({
  messages: '++id, serverId, roomId, content, author, createdAt, synced',
})

export const cacheManager = {
  // Guarda página comprimida
  async savePage(url, html, title) {
    const compressed = LZString.compress(html)
    const size = new Blob([compressed]).size
    const originalSize = new Blob([html]).size
    await db.pages.put({
      id: url,
      title,
      html: compressed,
      compressed: true,
      size,
      originalSize,
      cachedAt: Date.now(),
      status: 'cached'
    })
    return { size, originalSize, ratio: Math.round((1 - size / originalSize) * 100) }
  },

  // Lee página y descomprime
  async getPage(url) {
    const page = await db.pages.get(url)
    if (!page) return null
    if (page.compressed) {
      try {
        return { ...page, html: LZString.decompress(page.html) }
      } catch {
        await db.pages.delete(url)
        return null
      }
    }
    return page
  },

  async listPages() {
    return db.pages.orderBy('cachedAt').reverse().toArray()
  },

  async deletePage(url) {
    await db.pages.delete(url)
  },

  // Guarda respuesta de API comprimida
  async saveApiResponse(url, data, ttlSeconds = 3600) {
    const json = JSON.stringify(data)
    const compressed = LZString.compress(json)
    await db.apiCache.put({
      id: url,
      data: compressed,
      compressed: true,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlSeconds * 1000,
      status: 'cached'
    })
  },

  // Lee respuesta de API y descomprime
  async getApiResponse(url) {
    const entry = await db.apiCache.get(url)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) { await db.apiCache.delete(url); return null }
    if (entry.compressed) {
      return JSON.parse(LZString.decompress(entry.data))
    }
    return entry.data
  },

  async getTotalSize() {
    const pages = await db.pages.toArray()
    const files = await db.files.toArray()
    return pages.reduce((s, p) => s + (p.size || 0), 0) +
           files.reduce((s, f) => s + (f.size || 0), 0)
  },

  // Elimina páginas y archivos con más de `days` días de antigüedad
  async clearOldCache(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const deletedPages = await db.pages.where('cachedAt').below(cutoff).delete()
    const deletedFiles = await db.files.where('cachedAt').below(cutoff).delete()
    return { deletedPages, deletedFiles }
  },

  // Elimina todo el caché de páginas y archivos
  async clearAllCache() {
    await db.pages.clear()
    await db.files.clear()
  },

  // Calcula cuánto espacio se ahorró con compresión
  async getCompressionStats() {
    const pages = await db.pages.toArray()
    const totalCompressed = pages.reduce((s, p) => s + (p.size || 0), 0)
    const totalOriginal = pages.reduce((s, p) => s + (p.originalSize || p.size || 0), 0)
    const saved = totalOriginal - totalCompressed
    const ratio = totalOriginal > 0 ? Math.round((saved / totalOriginal) * 100) : 0
    return { totalCompressed, totalOriginal, saved, ratio }
  }
}

export const queueManager = {
  async enqueue(type, payload) {
    await db.syncQueue.add({ type, payload, createdAt: Date.now(), retries: 0 })
    // Registra background sync para que el SW procese la cola al recuperar conexión
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready
        await reg.sync.register('sync-queue')
      }
    } catch {
      // Background Sync no disponible en este navegador — no es crítico
    }
  },
  async getQueue() {
    return db.syncQueue.orderBy('createdAt').toArray()
  },
  async dequeue(id) {
    await db.syncQueue.delete(id)
  },
  async incrementRetries(id, errorMessage) {
    await db.syncQueue.where('id').equals(id).modify(item => {
      item.retries++
      if (errorMessage) {
        item.lastError = errorMessage
        item.failedAt = Date.now()
      }
    })
  },
  async count() {
    return db.syncQueue.count()
  }
}

export const usageLogger = {
  async log(resourceId, resourceType, signalStrength) {
    await db.usageLog.add({ resourceId, resourceType, accessedAt: Date.now(), signalStrength })
  },
  async getMostAccessedOnWeakSignal() {
    const logs = await db.usageLog.where('signalStrength').belowOrEqual(1).toArray()
    const freq = {}
    for (const log of logs) freq[log.resourceId] = (freq[log.resourceId] || 0) + 1
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([resourceId, count]) => ({ resourceId, count }))
  }
}

export const backupManager = {
  async exportAll() {
    const [pages, files, messages] = await Promise.all([
      db.pages.toArray(),
      db.files.toArray(),
      db.messages.toArray(),
    ])
    const filesExport = files.map(({ data, ...rest }) => ({
      ...rest,
      data: data ? bufToB64(data) : null,
      _b64: true,
    }))
    const blob = new Blob(
      [JSON.stringify({ v: 1, exportedAt: Date.now(), pages, files: filesExport, messages })],
      { type: 'application/json' }
    )
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `bufferapp-${new Date().toISOString().slice(0, 10)}.json`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  },

  async importAll(file) {
    const backup = JSON.parse(await file.text())
    if (backup.v !== 1) throw new Error('Formato de backup no reconocido')
    const files = (backup.files || []).map(({ _b64, data, ...rest }) => ({
      ...rest,
      data: (_b64 && data) ? b64ToBuf(data) : data,
    }))
    await db.transaction('rw', db.pages, db.files, db.messages, async () => {
      if (backup.pages?.length) await db.pages.bulkPut(backup.pages)
      if (files.length) await db.files.bulkPut(files)
      if (backup.messages?.length) await db.messages.bulkPut(backup.messages)
    })
    return {
      pages: backup.pages?.length ?? 0,
      files: files.length,
      messages: backup.messages?.length ?? 0,
    }
  },
}

function bufToB64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(binary)
}

function b64ToBuf(b64) {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr.buffer
}
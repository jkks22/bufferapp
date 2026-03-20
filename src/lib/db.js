import Dexie from 'dexie'

export const db = new Dexie('BufferAppDB')

db.version(1).stores({
  pages: 'id, title, cachedAt, size, status',
  files: '++id, name, type, size, cachedAt, status',
  messages: '++id, roomId, content, author, createdAt, synced',
  apiCache: 'id, data, cachedAt, expiresAt, status',
  syncQueue: '++id, type, payload, createdAt, retries',
  usageLog: '++id, resourceId, resourceType, accessedAt, signalStrength',
})

export const cacheManager = {
  async savePage(url, html, title) {
    const size = new Blob([html]).size
    await db.pages.put({ id: url, title, html, size, cachedAt: Date.now(), status: 'cached' })
  },
  async getPage(url) {
    return db.pages.get(url)
  },
  async listPages() {
    return db.pages.orderBy('cachedAt').reverse().toArray()
  },
  async deletePage(url) {
    await db.pages.delete(url)
  },
  async saveApiResponse(url, data, ttlSeconds = 3600) {
    await db.apiCache.put({
      id: url, data, cachedAt: Date.now(),
      expiresAt: Date.now() + ttlSeconds * 1000, status: 'cached'
    })
  },
  async getApiResponse(url) {
    const entry = await db.apiCache.get(url)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) { await db.apiCache.delete(url); return null }
    return entry.data
  },
  async getTotalSize() {
    const pages = await db.pages.toArray()
    const files = await db.files.toArray()
    return pages.reduce((s, p) => s + (p.size || 0), 0) +
           files.reduce((s, f) => s + (f.size || 0), 0)
  }
}

export const queueManager = {
  async enqueue(type, payload) {
    await db.syncQueue.add({ type, payload, createdAt: Date.now(), retries: 0 })
  },
  async getQueue() {
    return db.syncQueue.orderBy('createdAt').toArray()
  },
  async dequeue(id) {
    await db.syncQueue.delete(id)
  },
  async incrementRetries(id) {
    await db.syncQueue.where('id').equals(id).modify(item => { item.retries++ })
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
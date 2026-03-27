import { db, cacheManager } from './db'

export const predictor = {
  // Analiza el historial y devuelve qué recursos
  // se usan más cuando la señal es débil o nula
  async getSuggestions() {
    const logs = await db.usageLog.toArray()
    if (logs.length === 0) return []

    // Cuenta cuántas veces se accedió a cada recurso con señal débil
    const weakSignalAccess = {}
    for (const log of logs) {
      if (log.signalStrength <= 1) {
        if (!weakSignalAccess[log.resourceId]) {
          weakSignalAccess[log.resourceId] = {
            resourceId: log.resourceId,
            resourceType: log.resourceType,
            count: 0,
            lastAccessed: 0
          }
        }
        weakSignalAccess[log.resourceId].count++
        weakSignalAccess[log.resourceId].lastAccessed = Math.max(
          weakSignalAccess[log.resourceId].lastAccessed,
          log.accessedAt
        )
      }
    }

    // Ordena por frecuencia de acceso
    return Object.values(weakSignalAccess)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  },

  // Detecta la hora del día en que más frecuentemente
  // se pierde señal, basado en el historial
  async getWeakSignalHours() {
    const logs = await db.usageLog
      .where('signalStrength').belowOrEqual(1)
      .toArray()

    const hourCount = new Array(24).fill(0)
    for (const log of logs) {
      const hour = new Date(log.accessedAt).getHours()
      hourCount[hour]++
    }

    // Devuelve las 3 horas con más accesos sin señal
    return hourCount
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .filter(h => h.count > 0)
  },

  // Decide si vale la pena pre-descargar ahora
  // basado en la calidad de señal actual
  shouldPrefetch(signalStrength) {
    // Pre-descarga solo cuando la señal es buena o excelente
    return signalStrength >= 3
  },

  // Pre-descarga automáticamente las páginas sugeridas
  async autoPrefetch(signalStrength) {
    if (!this.shouldPrefetch(signalStrength)) return []

    const suggestions = await this.getSuggestions()
    const prefetched = []

    for (const suggestion of suggestions) {
      if (suggestion.resourceType !== 'page') continue

      // Verifica si ya está en caché
      const existing = await cacheManager.getPage(suggestion.resourceId)
      if (existing) continue

      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(suggestion.resourceId)}`
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) continue
        const html = await res.text()
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        const title = titleMatch ? titleMatch[1].trim() : suggestion.resourceId
        await cacheManager.savePage(suggestion.resourceId, html, title)
        prefetched.push(suggestion.resourceId)
      } catch {
        // Si falla silenciosamente, continúa con el siguiente
        continue
      }
    }

    return prefetched
  },

  // Registra que se accedió a un recurso
  // Llama esto cada vez que el usuario abre una página o archivo
  async logAccess(resourceId, resourceType, signalStrength) {
    await db.usageLog.add({
      resourceId,
      resourceType,
      accessedAt: Date.now(),
      signalStrength
    })

    // Limpia logs viejos (más de 30 días) para no llenar la DB
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    await db.usageLog.where('accessedAt').below(thirtyDaysAgo).delete()
  }
}
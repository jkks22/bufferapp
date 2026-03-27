import { useEffect, useRef, useState } from 'react'
import { db, queueManager } from '../lib/db'
import { useNetwork } from './useNetwork'

const MAX_RETRIES = 3
const BACKOFF_MS = [2000, 5000, 10000] // espera según número de reintentos previos

export function useSync() {
  const { isOnline } = useNetwork()
  const isSyncing = useRef(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!isOnline) return
    if (isSyncing.current) return
    processQueue()
  }, [isOnline])

  async function processQueue() {
    const queue = await queueManager.getQueue()
    if (queue.length === 0) return

    console.log(`[Sync] Procesando ${queue.length} item(s) en cola...`)
    isSyncing.current = true
    setSyncing(true)

    for (const item of queue) {
      if (item.retries >= MAX_RETRIES) {
        console.warn(`[Sync] Descartando item #${item.id} tras ${MAX_RETRIES} reintentos`)
        await queueManager.dequeue(item.id)
        continue
      }
      try {
        const wait = BACKOFF_MS[item.retries] ?? 0
        if (wait > 0) await new Promise(r => setTimeout(r, wait))
        await sendItem(item)
        await queueManager.dequeue(item.id)
        console.log(`[Sync] ✓ Item #${item.id} sincronizado`)
      } catch (err) {
        console.error(`[Sync] ✗ Error en item #${item.id}:`, err.message)
        await queueManager.incrementRetries(item.id)
      }
    }

    isSyncing.current = false
    setSyncing(false)
    console.log('[Sync] Cola procesada.')
  }

  async function sendItem(item) {
    const { type, payload } = item

    switch (type) {
      case 'HTTP_REQUEST': {
        const res = await fetch(payload.url, {
          method: payload.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.body)
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      case 'SEND_MESSAGE': {
        const { localId, ...msgPayload } = payload
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msgPayload)
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        // Marca el registro local como sincronizado
        if (localId) {
          const saved = await res.json()
          await db.messages.update(localId, { synced: true, serverId: saved.id })
        }
        break
      }
      default:
        console.warn(`[Sync] Tipo desconocido: ${type}`)
    }
  }

  return { processQueue, syncing }
}
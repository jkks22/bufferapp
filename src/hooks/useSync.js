import { useEffect, useRef } from 'react'
import { queueManager } from '../lib/db'
import { useNetwork } from './useNetwork'

const MAX_RETRIES = 3

export function useSync() {
  const { isOnline } = useNetwork()
  const isSyncing = useRef(false)

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

    for (const item of queue) {
      if (item.retries >= MAX_RETRIES) {
        console.warn(`[Sync] Descartando item #${item.id} tras ${MAX_RETRIES} reintentos`)
        await queueManager.dequeue(item.id)
        continue
      }
      try {
        await sendItem(item)
        await queueManager.dequeue(item.id)
        console.log(`[Sync] ✓ Item #${item.id} sincronizado`)
      } catch (err) {
        console.error(`[Sync] ✗ Error en item #${item.id}:`, err.message)
        await queueManager.incrementRetries(item.id)
      }
    }

    isSyncing.current = false
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
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      default:
        console.warn(`[Sync] Tipo desconocido: ${type}`)
    }
  }

  return { processQueue }
}
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSync } from '../../hooks/useSync'
import * as dbModule from '../../lib/db'

vi.mock('../../lib/db', () => ({
  db: {
    messages: {
      update: vi.fn().mockResolvedValue(undefined),
    }
  },
  queueManager: {
    getQueue: vi.fn(),
    dequeue: vi.fn(),
    incrementRetries: vi.fn(),
    count: vi.fn(),
  }
}))

vi.mock('../../hooks/useNetwork', () => ({
  useNetwork: vi.fn(() => ({ isOnline: true }))
}))

import { useNetwork } from '../../hooks/useNetwork'

beforeEach(() => {
  vi.clearAllMocks()
  dbModule.queueManager.getQueue.mockResolvedValue([])
  dbModule.queueManager.dequeue.mockResolvedValue(undefined)
  dbModule.queueManager.incrementRetries.mockResolvedValue(undefined)
  dbModule.db.messages.update.mockResolvedValue(undefined)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ id: 'server-uuid' }) }))
})

describe('useSync', () => {
  it('no procesa la cola si está offline', async () => {
    useNetwork.mockReturnValue({ isOnline: false })
    renderHook(() => useSync())
    await vi.waitFor(() => {})
    expect(dbModule.queueManager.getQueue).not.toHaveBeenCalled()
  })

  it('procesa la cola automáticamente al estar online', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    renderHook(() => useSync())
    await waitFor(() => expect(dbModule.queueManager.getQueue).toHaveBeenCalled())
  })

  it('descarta items con retries >= MAX_RETRIES (3)', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 1, type: 'HTTP_REQUEST', payload: { url: 'https://api.com' }, retries: 3 }
    ])
    renderHook(() => useSync())
    await waitFor(() => expect(dbModule.queueManager.dequeue).toHaveBeenCalledWith(1))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('hace fetch correcto para HTTP_REQUEST', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 2, type: 'HTTP_REQUEST', payload: { url: 'https://api.com/data', method: 'POST', body: { x: 1 } }, retries: 0 }
    ])
    renderHook(() => useSync())
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('https://api.com/data', expect.objectContaining({ method: 'POST' })))
    expect(dbModule.queueManager.dequeue).toHaveBeenCalledWith(2)
  })

  it('hace fetch a /api/messages para SEND_MESSAGE', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 3, type: 'SEND_MESSAGE', payload: { content: 'hola', roomId: 'general' }, retries: 0 }
    ])
    renderHook(() => useSync())
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/messages', expect.objectContaining({ method: 'POST' })))
    expect(dbModule.queueManager.dequeue).toHaveBeenCalledWith(3)
  })

  it('SEND_MESSAGE con localId actualiza el registro local como synced', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 4, type: 'SEND_MESSAGE', payload: { content: 'hola', roomId: 'general', localId: 99 }, retries: 0 }
    ])
    renderHook(() => useSync())
    await waitFor(() => {
      expect(dbModule.db.messages.update).toHaveBeenCalledWith(99, expect.objectContaining({ synced: true, serverId: 'server-uuid' }))
    })
  })

  it('incrementa retries si el fetch falla', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 5, type: 'HTTP_REQUEST', payload: { url: 'https://api.com' }, retries: 0 }
    ])
    renderHook(() => useSync())
    await waitFor(() => expect(dbModule.queueManager.incrementRetries).toHaveBeenCalledWith(5))
    expect(dbModule.queueManager.dequeue).not.toHaveBeenCalled()
  })

  it('incrementa retries si el fetch responde con error HTTP', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    // retries: 0 → sin backoff, así el test no necesita fake timers
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 6, type: 'SEND_MESSAGE', payload: { content: 'test' }, retries: 0 }
    ])
    renderHook(() => useSync())
    await waitFor(() => expect(dbModule.queueManager.incrementRetries).toHaveBeenCalledWith(6))
  })

  it('expone processQueue y syncing', () => {
    useNetwork.mockReturnValue({ isOnline: false })
    const { result } = renderHook(() => useSync())
    expect(typeof result.current.processQueue).toBe('function')
    expect(typeof result.current.syncing).toBe('boolean')
  })

  it('syncing es false cuando no hay items en la cola', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    dbModule.queueManager.getQueue.mockResolvedValue([])
    const { result } = renderHook(() => useSync())
    await waitFor(() => expect(dbModule.queueManager.getQueue).toHaveBeenCalled())
    expect(result.current.syncing).toBe(false)
  })
})

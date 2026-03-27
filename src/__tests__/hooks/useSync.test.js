import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSync } from '../../hooks/useSync'
import * as dbModule from '../../lib/db'

// Mock del módulo db para aislar de IndexedDB
vi.mock('../../lib/db', () => ({
  queueManager: {
    getQueue: vi.fn(),
    dequeue: vi.fn(),
    incrementRetries: vi.fn(),
    count: vi.fn(),
  }
}))

// Mock de useNetwork para controlar el estado de red
vi.mock('../../hooks/useNetwork', () => ({
  useNetwork: vi.fn(() => ({ isOnline: true }))
}))

import { useNetwork } from '../../hooks/useNetwork'

beforeEach(() => {
  vi.clearAllMocks()
  dbModule.queueManager.getQueue.mockResolvedValue([])
  dbModule.queueManager.dequeue.mockResolvedValue(undefined)
  dbModule.queueManager.incrementRetries.mockResolvedValue(undefined)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
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
    dbModule.queueManager.getQueue.mockResolvedValue([])
    renderHook(() => useSync())
    await waitFor(() => {
      expect(dbModule.queueManager.getQueue).toHaveBeenCalled()
    })
  })

  it('descarta items con retries >= MAX_RETRIES (3)', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 1, type: 'HTTP_REQUEST', payload: { url: 'https://api.com' }, retries: 3 }
    ])
    renderHook(() => useSync())
    await waitFor(() => {
      expect(dbModule.queueManager.dequeue).toHaveBeenCalledWith(1)
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('hace fetch correcto para HTTP_REQUEST', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 2, type: 'HTTP_REQUEST', payload: { url: 'https://api.com/data', method: 'POST', body: { x: 1 } }, retries: 0 }
    ])
    renderHook(() => useSync())
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('https://api.com/data', expect.objectContaining({ method: 'POST' }))
    })
    expect(dbModule.queueManager.dequeue).toHaveBeenCalledWith(2)
  })

  it('hace fetch a /api/messages para SEND_MESSAGE', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 3, type: 'SEND_MESSAGE', payload: { content: 'hola', roomId: 'general' }, retries: 0 }
    ])
    renderHook(() => useSync())
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/messages', expect.objectContaining({ method: 'POST' }))
    })
    expect(dbModule.queueManager.dequeue).toHaveBeenCalledWith(3)
  })

  it('incrementa retries si el fetch falla', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 4, type: 'HTTP_REQUEST', payload: { url: 'https://api.com' }, retries: 0 }
    ])
    renderHook(() => useSync())
    await waitFor(() => {
      expect(dbModule.queueManager.incrementRetries).toHaveBeenCalledWith(4)
    })
    expect(dbModule.queueManager.dequeue).not.toHaveBeenCalled()
  })

  it('incrementa retries si el fetch responde con error HTTP', async () => {
    useNetwork.mockReturnValue({ isOnline: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    dbModule.queueManager.getQueue.mockResolvedValue([
      { id: 5, type: 'SEND_MESSAGE', payload: { content: 'test' }, retries: 1 }
    ])
    renderHook(() => useSync())
    await waitFor(() => {
      expect(dbModule.queueManager.incrementRetries).toHaveBeenCalledWith(5)
    })
  })

  it('expone processQueue como función', () => {
    useNetwork.mockReturnValue({ isOnline: false })
    dbModule.queueManager.getQueue.mockResolvedValue([])
    const { result } = renderHook(() => useSync())
    expect(typeof result.current.processQueue).toBe('function')
  })
})

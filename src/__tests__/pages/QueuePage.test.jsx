import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QueuePage from '../../pages/QueuePage'

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}))

vi.mock('../../lib/db', () => ({
  db: {
    syncQueue: {
      orderBy: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
  queueManager: {
    enqueue: vi.fn().mockResolvedValue(undefined),
    dequeue: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../hooks/useNetwork', () => ({
  useNetwork: vi.fn(() => ({ isOnline: true })),
}))

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(() => ({ processQueue: vi.fn(), syncing: false })),
}))

import { useLiveQuery } from 'dexie-react-hooks'
import { useNetwork } from '../../hooks/useNetwork'
import { useSync } from '../../hooks/useSync'
import { db, queueManager } from '../../lib/db'

const SAMPLE_ITEMS = [
  { id: 1, type: 'HTTP_REQUEST', payload: { url: '/api/demo', method: 'POST', body: {} }, createdAt: Date.now(), retries: 0 },
  { id: 2, type: 'SEND_MESSAGE', payload: { message: 'Hola desde queue', roomId: 'general' }, createdAt: Date.now(), retries: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
  useNetwork.mockReturnValue({ isOnline: true })
  useSync.mockReturnValue({ processQueue: vi.fn(), syncing: false })
  useLiveQuery.mockReturnValue([])
})

describe('QueuePage', () => {
  it('muestra el título de la página', () => {
    render(<QueuePage />)
    expect(screen.getByText('Cola de sincronización')).toBeInTheDocument()
  })

  it('muestra estado vacío cuando la cola está vacía', () => {
    render(<QueuePage />)
    expect(screen.getByText('La cola está vacía')).toBeInTheDocument()
  })

  it('muestra "Todo sincronizado" cuando online y cola vacía', () => {
    render(<QueuePage />)
    expect(screen.getByText('Todo sincronizado')).toBeInTheDocument()
  })

  it('muestra mensaje offline cuando no hay conexión', () => {
    useNetwork.mockReturnValue({ isOnline: false })
    render(<QueuePage />)
    expect(screen.getByText(/Sin conexión/)).toBeInTheDocument()
  })

  it('muestra los items de la cola', () => {
    useLiveQuery.mockReturnValue(SAMPLE_ITEMS)
    render(<QueuePage />)
    expect(screen.getByText('Petición HTTP')).toBeInTheDocument()
    expect(screen.getByText('Mensaje')).toBeInTheDocument()
  })

  it('muestra la URL del item HTTP', () => {
    useLiveQuery.mockReturnValue(SAMPLE_ITEMS)
    render(<QueuePage />)
    expect(screen.getByText('/api/demo')).toBeInTheDocument()
  })

  it('muestra badge de reintentos cuando retries > 0', () => {
    useLiveQuery.mockReturnValue(SAMPLE_ITEMS)
    render(<QueuePage />)
    expect(screen.getByText('1 reintentos')).toBeInTheDocument()
  })

  it('muestra botón Sincronizar cuando online con items', () => {
    useLiveQuery.mockReturnValue(SAMPLE_ITEMS)
    render(<QueuePage />)
    expect(screen.getByText('Sincronizar ahora')).toBeInTheDocument()
  })

  it('llama processQueue al hacer click en Sincronizar', () => {
    const processQueue = vi.fn()
    useSync.mockReturnValue({ processQueue, syncing: false })
    useLiveQuery.mockReturnValue(SAMPLE_ITEMS)
    render(<QueuePage />)
    fireEvent.click(screen.getByText('Sincronizar ahora'))
    expect(processQueue).toHaveBeenCalledOnce()
  })

  it('muestra "Sincronizando..." mientras syncing=true', () => {
    useSync.mockReturnValue({ processQueue: vi.fn(), syncing: true })
    useLiveQuery.mockReturnValue(SAMPLE_ITEMS)
    render(<QueuePage />)
    expect(screen.getByText('Sincronizando...')).toBeInTheDocument()
  })

  it('llama dequeue al eliminar un item', () => {
    useLiveQuery.mockReturnValue(SAMPLE_ITEMS)
    render(<QueuePage />)
    const removeBtns = screen.getAllByText('✕')
    fireEvent.click(removeBtns[0])
    expect(queueManager.dequeue).toHaveBeenCalledWith(1)
  })

  it('muestra botón Limpiar cola cuando hay items', () => {
    useLiveQuery.mockReturnValue(SAMPLE_ITEMS)
    render(<QueuePage />)
    expect(screen.getByText('Limpiar cola')).toBeInTheDocument()
  })

  it('limpia la cola al hacer click en Limpiar cola', () => {
    useLiveQuery.mockReturnValue(SAMPLE_ITEMS)
    render(<QueuePage />)
    fireEvent.click(screen.getByText('Limpiar cola'))
    expect(db.syncQueue.clear).toHaveBeenCalledOnce()
  })

  it('agrega item de prueba al hacer click en el botón dev', async () => {
    render(<QueuePage />)
    fireEvent.click(screen.getByText('+ Agregar item de prueba'))
    expect(queueManager.enqueue).toHaveBeenCalledWith(
      'HTTP_REQUEST',
      expect.objectContaining({ url: '/api/demo', method: 'POST' })
    )
  })

  it('cuenta items con texto correcto (plural)', () => {
    useLiveQuery.mockReturnValue(SAMPLE_ITEMS)
    render(<QueuePage />)
    expect(screen.getByText(/2 item\(s\) listos para sincronizar/)).toBeInTheDocument()
  })
})

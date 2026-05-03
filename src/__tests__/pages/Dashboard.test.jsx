import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Dashboard from '../../pages/Dashboard'

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => 0),
}))

vi.mock('../../lib/db', () => ({
  db: {
    pages: { count: vi.fn().mockResolvedValue(3) },
    files: { count: vi.fn().mockResolvedValue(2) },
  },
  cacheManager: {
    getTotalSize: vi.fn().mockResolvedValue(10 * 1024 * 1024),
    getCompressionStats: vi.fn().mockResolvedValue({ ratio: 45, saved: 4 * 1024 * 1024, totalOriginal: 9 * 1024 * 1024 }),
    clearOldCache: vi.fn().mockResolvedValue({ deletedPages: 1, deletedFiles: 0 }),
    clearAllCache: vi.fn().mockResolvedValue(undefined),
  },
  queueManager: {
    count: vi.fn().mockResolvedValue(0),
  },
}))

vi.mock('../../hooks/useNetwork', () => ({
  useNetwork: vi.fn(() => ({ isOnline: true, signalStrength: 3 })),
}))

vi.mock('../../hooks/usePredictor', () => ({
  usePredictor: vi.fn(() => ({
    suggestions: [],
    weakHours: [],
    prefetching: false,
    lastPrefetched: [],
    autoPrefetchEnabled: false,
    toggleAutoPrefetch: vi.fn(),
    formatHour: h => `${h}:00`,
  })),
}))

import { useLiveQuery } from 'dexie-react-hooks'
import { useNetwork } from '../../hooks/useNetwork'
import { usePredictor } from '../../hooks/usePredictor'

beforeEach(() => {
  vi.clearAllMocks()
  useLiveQuery.mockReturnValue(0)
  useNetwork.mockReturnValue({ isOnline: true, signalStrength: 3 })
  usePredictor.mockReturnValue({
    suggestions: [],
    weakHours: [],
    prefetching: false,
    lastPrefetched: [],
    autoPrefetchEnabled: false,
    toggleAutoPrefetch: vi.fn(),
    formatHour: h => `${h}:00`,
  })
})

describe('Dashboard', () => {
  it('muestra el título BufferApp', () => {
    render(<Dashboard />)
    expect(screen.getByText('BufferApp')).toBeInTheDocument()
  })

  it('muestra el estado de conexión online', () => {
    render(<Dashboard />)
    expect(screen.getByText('conectado')).toBeInTheDocument()
  })

  it('muestra estado offline cuando no hay conexión', () => {
    useNetwork.mockReturnValue({ isOnline: false, signalStrength: 0 })
    render(<Dashboard />)
    expect(screen.getByText('offline')).toBeInTheDocument()
  })

  it('muestra señal como Buena con signalStrength=3', () => {
    render(<Dashboard />)
    expect(screen.getByText('Buena')).toBeInTheDocument()
  })

  it('muestra aviso de señal débil con signalStrength=1', () => {
    useNetwork.mockReturnValue({ isOnline: true, signalStrength: 1 })
    render(<Dashboard />)
    expect(screen.getByText(/Señal débil/)).toBeInTheDocument()
  })

  it('muestra el toggle de pre-descarga automática', () => {
    render(<Dashboard />)
    expect(screen.getByText('Pre-descarga automática')).toBeInTheDocument()
    expect(screen.getByText('Desactivada')).toBeInTheDocument()
  })

  it('muestra "Activada" cuando autoPrefetchEnabled es true', () => {
    usePredictor.mockReturnValue({
      suggestions: [],
      weakHours: [],
      prefetching: false,
      lastPrefetched: [],
      autoPrefetchEnabled: true,
      toggleAutoPrefetch: vi.fn(),
      formatHour: h => `${h}:00`,
    })
    render(<Dashboard />)
    expect(screen.getByText('Activada')).toBeInTheDocument()
  })

  it('llama toggleAutoPrefetch al hacer click en el toggle', () => {
    const toggle = vi.fn()
    usePredictor.mockReturnValue({
      suggestions: [], weakHours: [], prefetching: false, lastPrefetched: [],
      autoPrefetchEnabled: false, toggleAutoPrefetch: toggle, formatHour: h => `${h}:00`,
    })
    render(<Dashboard />)
    fireEvent.click(screen.getByText('Desactivada'))
    expect(toggle).toHaveBeenCalledOnce()
  })

  it('muestra el banner de pre-descarga cuando prefetching=true', () => {
    usePredictor.mockReturnValue({
      suggestions: [], weakHours: [], prefetching: true, lastPrefetched: [],
      autoPrefetchEnabled: false, toggleAutoPrefetch: vi.fn(), formatHour: h => `${h}:00`,
    })
    render(<Dashboard />)
    expect(screen.getByText(/Pre-descargando/)).toBeInTheDocument()
  })

  it('muestra sugerencias del predictor', () => {
    usePredictor.mockReturnValue({
      suggestions: [{ resourceId: 'https://test.com', resourceType: 'page', count: 5 }],
      weakHours: [],
      prefetching: false,
      lastPrefetched: [],
      autoPrefetchEnabled: false,
      toggleAutoPrefetch: vi.fn(),
      formatHour: h => `${h}:00`,
    })
    render(<Dashboard />)
    expect(screen.getByText('https://test.com')).toBeInTheDocument()
    expect(screen.getByText('5x')).toBeInTheDocument()
  })

  it('muestra horas con señal débil', () => {
    usePredictor.mockReturnValue({
      suggestions: [],
      weakHours: [{ hour: 8, count: 3 }, { hour: 14, count: 2 }],
      prefetching: false,
      lastPrefetched: [],
      autoPrefetchEnabled: false,
      toggleAutoPrefetch: vi.fn(),
      formatHour: h => `${h}:00`,
    })
    render(<Dashboard />)
    expect(screen.getByText('8:00')).toBeInTheDocument()
    expect(screen.getByText('3 veces')).toBeInTheDocument()
  })

  it('muestra banner de cola offline cuando hay items pendientes', () => {
    useNetwork.mockReturnValue({ isOnline: false, signalStrength: 0 })
    useLiveQuery.mockReturnValue(2)
    render(<Dashboard />)
    expect(screen.getByText(/acciones en cola/)).toBeInTheDocument()
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePredictor } from '../../hooks/usePredictor'

vi.mock('../../lib/predictor', () => ({
  predictor: {
    getSuggestions: vi.fn().mockResolvedValue([]),
    getWeakSignalHours: vi.fn().mockResolvedValue([]),
    autoPrefetch: vi.fn().mockResolvedValue([]),
    logAccess: vi.fn().mockResolvedValue(undefined),
    shouldPrefetch: vi.fn().mockReturnValue(false),
  }
}))

vi.mock('../../hooks/useNetwork', () => ({
  useNetwork: vi.fn(() => ({ isOnline: true, signalStrength: 2 }))
}))

import { predictor } from '../../lib/predictor'
import { useNetwork } from '../../hooks/useNetwork'

afterEach(() => {
  localStorage.clear()
})

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  predictor.getSuggestions.mockResolvedValue([])
  predictor.getWeakSignalHours.mockResolvedValue([])
  predictor.autoPrefetch.mockResolvedValue([])
  predictor.logAccess.mockResolvedValue(undefined)
  predictor.shouldPrefetch.mockReturnValue(false)
  useNetwork.mockReturnValue({ isOnline: true, signalStrength: 2 })
})

describe('usePredictor', () => {
  it('carga sugerencias y weakHours al montar', async () => {
    const sugs = [{ resourceId: 'https://a.com', resourceType: 'page', count: 3 }]
    const hours = [{ hour: 8, count: 5 }]
    predictor.getSuggestions.mockResolvedValue(sugs)
    predictor.getWeakSignalHours.mockResolvedValue(hours)

    const { result } = renderHook(() => usePredictor())
    await waitFor(() => {
      expect(result.current.suggestions).toEqual(sugs)
      expect(result.current.weakHours).toEqual(hours)
    })
  })

  it('no pre-descarga si signalStrength < 3', async () => {
    useNetwork.mockReturnValue({ isOnline: true, signalStrength: 2 })
    renderHook(() => usePredictor())
    await waitFor(() => expect(predictor.getSuggestions).toHaveBeenCalled())
    expect(predictor.autoPrefetch).not.toHaveBeenCalled()
  })

  it('intenta pre-descargar automáticamente con señal >= 3', async () => {
    useNetwork.mockReturnValue({ isOnline: true, signalStrength: 4 })
    renderHook(() => usePredictor())
    await waitFor(() => {
      expect(predictor.autoPrefetch).toHaveBeenCalledWith(4)
    })
  })

  it('no pre-descarga si está offline', async () => {
    useNetwork.mockReturnValue({ isOnline: false, signalStrength: 4 })
    renderHook(() => usePredictor())
    await waitFor(() => expect(predictor.getSuggestions).toHaveBeenCalled())
    expect(predictor.autoPrefetch).not.toHaveBeenCalled()
  })

  it('actualiza lastPrefetched cuando autoPrefetch devuelve URLs', async () => {
    useNetwork.mockReturnValue({ isOnline: true, signalStrength: 4 })
    predictor.autoPrefetch.mockResolvedValue(['https://a.com', 'https://b.com'])

    const { result } = renderHook(() => usePredictor())
    await waitFor(() => {
      expect(result.current.lastPrefetched).toEqual(['https://a.com', 'https://b.com'])
    })
  })

  it('logAccess registra el acceso con la señal actual', async () => {
    useNetwork.mockReturnValue({ isOnline: true, signalStrength: 2 })
    const { result } = renderHook(() => usePredictor())
    await waitFor(() => expect(predictor.getSuggestions).toHaveBeenCalled())
    await result.current.logAccess('https://example.com', 'page')
    expect(predictor.logAccess).toHaveBeenCalledWith('https://example.com', 'page', 2)
  })

  it('formatHour convierte hora a formato 12h', async () => {
    useNetwork.mockReturnValue({ isOnline: false, signalStrength: 0 })
    const { result } = renderHook(() => usePredictor())
    expect(result.current.formatHour(0)).toBe('12:00 am')
    expect(result.current.formatHour(8)).toBe('8:00 am')
    expect(result.current.formatHour(12)).toBe('12:00 pm')
    expect(result.current.formatHour(20)).toBe('8:00 pm')
  })

  it('expone shouldPrefetch basado en la señal actual', async () => {
    useNetwork.mockReturnValue({ isOnline: true, signalStrength: 3 })
    predictor.shouldPrefetch.mockReturnValue(true)
    const { result } = renderHook(() => usePredictor())
    expect(result.current.shouldPrefetch).toBe(true)
  })

  it('autoPrefetchEnabled es true por defecto', () => {
    useNetwork.mockReturnValue({ isOnline: false, signalStrength: 0 })
    const { result } = renderHook(() => usePredictor())
    expect(result.current.autoPrefetchEnabled).toBe(true)
  })

  it('autoPrefetchEnabled es false si localStorage lo dice', () => {
    localStorage.setItem('autoPrefetch', 'false')
    useNetwork.mockReturnValue({ isOnline: false, signalStrength: 0 })
    const { result } = renderHook(() => usePredictor())
    expect(result.current.autoPrefetchEnabled).toBe(false)
  })

  it('toggleAutoPrefetch cambia el estado y lo persiste en localStorage', async () => {
    useNetwork.mockReturnValue({ isOnline: false, signalStrength: 0 })
    const { result } = renderHook(() => usePredictor())
    expect(result.current.autoPrefetchEnabled).toBe(true)
    act(() => result.current.toggleAutoPrefetch())
    expect(result.current.autoPrefetchEnabled).toBe(false)
    expect(localStorage.getItem('autoPrefetch')).toBe('false')
    act(() => result.current.toggleAutoPrefetch())
    expect(result.current.autoPrefetchEnabled).toBe(true)
    expect(localStorage.getItem('autoPrefetch')).toBe('true')
  })

  it('no pre-descarga si autoPrefetchEnabled es false aunque señal sea buena', async () => {
    localStorage.setItem('autoPrefetch', 'false')
    useNetwork.mockReturnValue({ isOnline: true, signalStrength: 4 })
    renderHook(() => usePredictor())
    await waitFor(() => expect(predictor.getSuggestions).toHaveBeenCalled())
    expect(predictor.autoPrefetch).not.toHaveBeenCalled()
  })
})

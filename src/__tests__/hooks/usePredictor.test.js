import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
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

beforeEach(() => {
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
})

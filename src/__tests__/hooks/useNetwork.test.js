import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNetwork } from '../../hooks/useNetwork'

function setNavigator({ onLine = true, connection = null } = {}) {
  vi.stubGlobal('navigator', {
    onLine,
    connection,
    mozConnection: null,
    webkitConnection: null,
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useNetwork', () => {
  it('refleja el estado inicial de navigator.onLine', () => {
    setNavigator({ onLine: true, connection: { effectiveType: '4g', downlink: 10, rtt: 20, addEventListener: vi.fn(), removeEventListener: vi.fn() } })
    const { result } = renderHook(() => useNetwork())
    expect(result.current.isOnline).toBe(true)
  })

  it('refleja offline en estado inicial', () => {
    setNavigator({ onLine: false, connection: null })
    const { result } = renderHook(() => useNetwork())
    expect(result.current.isOnline).toBe(false)
    expect(result.current.signalStrength).toBe(0)
  })

  it('actualiza isOnline al disparar evento online', () => {
    setNavigator({ onLine: false, connection: null })
    const { result } = renderHook(() => useNetwork())
    act(() => {
      vi.stubGlobal('navigator', { ...navigator, onLine: true, connection: null, mozConnection: null, webkitConnection: null })
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current.isOnline).toBe(true)
  })

  it('actualiza isOnline al disparar evento offline', () => {
    setNavigator({ onLine: true, connection: { effectiveType: '4g', downlink: 10, rtt: 0, addEventListener: vi.fn(), removeEventListener: vi.fn() } })
    const { result } = renderHook(() => useNetwork())
    act(() => {
      vi.stubGlobal('navigator', { onLine: false, connection: null, mozConnection: null, webkitConnection: null })
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.isOnline).toBe(false)
  })

  it('calcula signalStrength 4 para 4g con downlink > 5', () => {
    setNavigator({ onLine: true, connection: { effectiveType: '4g', downlink: 10, rtt: 20, addEventListener: vi.fn(), removeEventListener: vi.fn() } })
    const { result } = renderHook(() => useNetwork())
    expect(result.current.signalStrength).toBe(4)
  })

  it('calcula signalStrength 3 para 4g con downlink <= 5', () => {
    setNavigator({ onLine: true, connection: { effectiveType: '4g', downlink: 3, rtt: 50, addEventListener: vi.fn(), removeEventListener: vi.fn() } })
    const { result } = renderHook(() => useNetwork())
    expect(result.current.signalStrength).toBe(3)
  })

  it('calcula signalStrength 2 para 3g', () => {
    setNavigator({ onLine: true, connection: { effectiveType: '3g', downlink: 1, rtt: 100, addEventListener: vi.fn(), removeEventListener: vi.fn() } })
    const { result } = renderHook(() => useNetwork())
    expect(result.current.signalStrength).toBe(2)
  })

  it('calcula signalStrength 1 para 2g', () => {
    setNavigator({ onLine: true, connection: { effectiveType: '2g', downlink: 0.2, rtt: 300, addEventListener: vi.fn(), removeEventListener: vi.fn() } })
    const { result } = renderHook(() => useNetwork())
    expect(result.current.signalStrength).toBe(1)
  })

  it('calcula signalStrength 3 por defecto si no hay connection API', () => {
    setNavigator({ onLine: true, connection: null })
    const { result } = renderHook(() => useNetwork())
    expect(result.current.signalStrength).toBe(3)
  })
})

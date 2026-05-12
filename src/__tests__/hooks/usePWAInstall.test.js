import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePWAInstall } from '../../hooks/usePWAInstall'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})

describe('usePWAInstall', () => {
  it('isInstallable es false sin prompt', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.isInstallable).toBe(false)
  })

  it('isInstalled es false en modo no-standalone', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.isInstalled).toBe(false)
  })

  it('isInstalled es true en modo standalone', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.isInstalled).toBe(true)
  })

  it('se vuelve instalable al recibir beforeinstallprompt', () => {
    const { result } = renderHook(() => usePWAInstall())
    const mockEvent = new Event('beforeinstallprompt')
    mockEvent.prompt = vi.fn().mockResolvedValue(undefined)
    mockEvent.userChoice = Promise.resolve({ outcome: 'dismissed' })
    act(() => {
      window.dispatchEvent(mockEvent)
    })
    expect(result.current.isInstallable).toBe(true)
  })

  it('marca isInstalled true y limpia prompt al recibir appinstalled', () => {
    const { result } = renderHook(() => usePWAInstall())
    const mockEvent = new Event('beforeinstallprompt')
    mockEvent.prompt = vi.fn()
    mockEvent.userChoice = Promise.resolve({ outcome: 'dismissed' })
    act(() => { window.dispatchEvent(mockEvent) })
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(result.current.isInstalled).toBe(true)
    expect(result.current.isInstallable).toBe(false)
  })

  it('promptInstall no hace nada sin prompt disponible', async () => {
    const { result } = renderHook(() => usePWAInstall())
    await act(async () => { await result.current.promptInstall() })
    expect(result.current.isInstalled).toBe(false)
  })

  it('promptInstall marca isInstalled al aceptar', async () => {
    const { result } = renderHook(() => usePWAInstall())
    const mockEvent = new Event('beforeinstallprompt')
    mockEvent.prompt = vi.fn().mockResolvedValue(undefined)
    mockEvent.userChoice = Promise.resolve({ outcome: 'accepted' })
    act(() => { window.dispatchEvent(mockEvent) })
    await act(async () => { await result.current.promptInstall() })
    expect(result.current.isInstalled).toBe(true)
    expect(result.current.isInstallable).toBe(false)
  })

  it('promptInstall no marca isInstalled si el usuario descarta', async () => {
    const { result } = renderHook(() => usePWAInstall())
    const mockEvent = new Event('beforeinstallprompt')
    mockEvent.prompt = vi.fn().mockResolvedValue(undefined)
    mockEvent.userChoice = Promise.resolve({ outcome: 'dismissed' })
    act(() => { window.dispatchEvent(mockEvent) })
    await act(async () => { await result.current.promptInstall() })
    expect(result.current.isInstalled).toBe(false)
  })
})

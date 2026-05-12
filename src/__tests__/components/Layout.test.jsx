import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../../components/Layout'

vi.mock('../../hooks/useNetwork', () => ({
  useNetwork: vi.fn(() => ({ isOnline: true, signalStrength: 3, effectiveType: '4g', downlink: 10 })),
}))

vi.mock('../../hooks/usePWAInstall', () => ({
  usePWAInstall: vi.fn(() => ({ isInstallable: false, isInstalled: false, promptInstall: vi.fn() })),
}))

import { useNetwork } from '../../hooks/useNetwork'

beforeEach(() => {
  vi.clearAllMocks()
  useNetwork.mockReturnValue({ isOnline: true, signalStrength: 3, effectiveType: '4g', downlink: 10 })
})

function wrap(children) {
  return render(<MemoryRouter>{children}</MemoryRouter>)
}

describe('Layout', () => {
  it('renderiza el contenido hijo', () => {
    wrap(<Layout><div>contenido hijo</div></Layout>)
    expect(screen.getByText('contenido hijo')).toBeInTheDocument()
  })

  it('muestra la barra de red con info de señal online', () => {
    wrap(<Layout><div /></Layout>)
    expect(screen.getByText(/Buena/)).toBeInTheDocument()
    expect(screen.getByText(/4G/i)).toBeInTheDocument()
  })

  it('muestra badge OFFLINE cuando no hay conexión', () => {
    useNetwork.mockReturnValue({ isOnline: false, signalStrength: 0, effectiveType: 'unknown', downlink: 0 })
    wrap(<Layout><div /></Layout>)
    expect(screen.getByText('OFFLINE')).toBeInTheDocument()
    expect(screen.getByText(/Sin conexión/)).toBeInTheDocument()
  })

  it('muestra los 4 enlaces de navegación inferior', () => {
    wrap(<Layout><div /></Layout>)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Caché')).toBeInTheDocument()
    expect(screen.getByText('Mensajes')).toBeInTheDocument()
    expect(screen.getByText('Cola')).toBeInTheDocument()
  })

  it('muestra señal débil con signalStrength=1', () => {
    useNetwork.mockReturnValue({ isOnline: true, signalStrength: 1, effectiveType: '2g', downlink: 0.1 })
    wrap(<Layout><div /></Layout>)
    expect(screen.getByText(/Débil/)).toBeInTheDocument()
  })

  it('muestra señal excelente con signalStrength=4', () => {
    useNetwork.mockReturnValue({ isOnline: true, signalStrength: 4, effectiveType: '4g', downlink: 20 })
    wrap(<Layout><div /></Layout>)
    expect(screen.getByText(/Excelente/)).toBeInTheDocument()
  })
})

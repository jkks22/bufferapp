import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InstallBanner from '../../components/InstallBanner'

vi.mock('../../hooks/usePWAInstall', () => ({
  usePWAInstall: vi.fn(() => ({ isInstallable: false, promptInstall: vi.fn() })),
}))

import { usePWAInstall } from '../../hooks/usePWAInstall'

beforeEach(() => {
  vi.clearAllMocks()
  usePWAInstall.mockReturnValue({ isInstallable: false, promptInstall: vi.fn() })
})

describe('InstallBanner', () => {
  it('no renderiza cuando no es instalable', () => {
    const { container } = render(<InstallBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza el banner cuando es instalable', () => {
    usePWAInstall.mockReturnValue({ isInstallable: true, promptInstall: vi.fn() })
    render(<InstallBanner />)
    expect(screen.getByText(/Instala BufferApp/)).toBeInTheDocument()
    expect(screen.getByText('Instalar')).toBeInTheDocument()
  })

  it('llama promptInstall al hacer click en Instalar', () => {
    const promptInstall = vi.fn()
    usePWAInstall.mockReturnValue({ isInstallable: true, promptInstall })
    render(<InstallBanner />)
    fireEvent.click(screen.getByText('Instalar'))
    expect(promptInstall).toHaveBeenCalledOnce()
  })
})

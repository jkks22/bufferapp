import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UpdatePrompt from '../../components/UpdatePrompt'

function mockServiceWorker(registration) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve(registration),
      controller: {},
    },
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  // Restaura navigator.serviceWorker al estado original (undefined en jsdom)
  Object.defineProperty(navigator, 'serviceWorker', {
    value: undefined,
    configurable: true,
    writable: true,
  })
})

describe('UpdatePrompt', () => {
  it('no renderiza cuando no hay serviceWorker', () => {
    const { container } = render(<UpdatePrompt />)
    expect(container.firstChild).toBeNull()
  })

  it('no renderiza si no hay SW waiting ni updatefound', async () => {
    mockServiceWorker({ waiting: null, addEventListener: vi.fn() })
    const { container } = render(<UpdatePrompt />)
    // Espera que la promesa ready se resuelva
    await new Promise(r => setTimeout(r, 0))
    expect(container.firstChild).toBeNull()
  })

  it('muestra el prompt cuando hay SW waiting al montar', async () => {
    const waitingWorker = { postMessage: vi.fn() }
    mockServiceWorker({ waiting: waitingWorker, addEventListener: vi.fn() })
    render(<UpdatePrompt />)
    expect(await screen.findByText('Hay una nueva versión disponible')).toBeInTheDocument()
    expect(screen.getByText('Actualizar')).toBeInTheDocument()
    expect(screen.getByText('Ahora no')).toBeInTheDocument()
  })

  it('se descarta al hacer click en "Ahora no"', async () => {
    const waitingWorker = { postMessage: vi.fn() }
    mockServiceWorker({ waiting: waitingWorker, addEventListener: vi.fn() })
    render(<UpdatePrompt />)
    fireEvent.click(await screen.findByText('Ahora no'))
    expect(screen.queryByText('Hay una nueva versión disponible')).not.toBeInTheDocument()
  })

  it('envía SKIP_WAITING y recarga al hacer click en Actualizar', async () => {
    const waitingWorker = { postMessage: vi.fn() }
    const reloadMock = vi.fn()
    vi.stubGlobal('location', { reload: reloadMock })
    mockServiceWorker({ waiting: waitingWorker, addEventListener: vi.fn() })
    render(<UpdatePrompt />)
    fireEvent.click(await screen.findByText('Actualizar'))
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reloadMock).toHaveBeenCalled()
  })
})

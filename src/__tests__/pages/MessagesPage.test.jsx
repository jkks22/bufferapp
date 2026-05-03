import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MessagesPage from '../../pages/MessagesPage'

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}))

vi.mock('../../lib/db', () => ({
  db: {
    messages: {
      where: vi.fn(() => ({ equals: vi.fn(() => ({ sortBy: vi.fn().mockResolvedValue([]) })) })),
      add: vi.fn().mockResolvedValue(1),
    },
  },
  queueManager: {
    enqueue: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../hooks/useNetwork', () => ({
  useNetwork: vi.fn(() => ({ isOnline: true })),
}))

import { useLiveQuery } from 'dexie-react-hooks'
import { useNetwork } from '../../hooks/useNetwork'
import { db, queueManager } from '../../lib/db'

const TODAY_ISO = new Date().toISOString()
const SAMPLE_MESSAGES = [
  { id: 1, roomId: 'general', content: 'Hola mundo', author: 'Alice', createdAt: TODAY_ISO, synced: true },
  { id: 2, roomId: 'general', content: 'Respuesta', author: 'Yo', createdAt: TODAY_ISO, synced: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  useNetwork.mockReturnValue({ isOnline: true })
  useLiveQuery.mockReturnValue([])
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  localStorage.clear()
})

describe('MessagesPage', () => {
  it('muestra la sala general en el header', () => {
    render(<MessagesPage />)
    expect(screen.getByText('general')).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay mensajes', () => {
    render(<MessagesPage />)
    expect(screen.getByText(/Ningún mensaje en esta sala/)).toBeInTheDocument()
  })

  it('muestra los mensajes de la sala', () => {
    useLiveQuery.mockReturnValue(SAMPLE_MESSAGES)
    render(<MessagesPage />)
    expect(screen.getByText('Hola mundo')).toBeInTheDocument()
    expect(screen.getByText('Respuesta')).toBeInTheDocument()
  })

  it('muestra autor de mensajes de otros', () => {
    useLiveQuery.mockReturnValue(SAMPLE_MESSAGES)
    render(<MessagesPage />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('muestra chip "offline" cuando no hay conexión', () => {
    useNetwork.mockReturnValue({ isOnline: false })
    render(<MessagesPage />)
    expect(screen.getByText('offline')).toBeInTheDocument()
  })

  it('el input tiene placeholder correcto cuando online', () => {
    render(<MessagesPage />)
    expect(screen.getByPlaceholderText(/Escribe un mensaje/)).toBeInTheDocument()
  })

  it('el input tiene placeholder offline cuando sin conexión', () => {
    useNetwork.mockReturnValue({ isOnline: false })
    render(<MessagesPage />)
    expect(screen.getByPlaceholderText(/Offline/)).toBeInTheDocument()
  })

  it('el botón enviar está deshabilitado con input vacío', () => {
    render(<MessagesPage />)
    expect(screen.getByText('↑')).toBeDisabled()
  })

  it('el botón enviar se habilita al escribir texto', () => {
    render(<MessagesPage />)
    const input = screen.getByPlaceholderText(/Escribe un mensaje/)
    fireEvent.change(input, { target: { value: 'Hola' } })
    expect(screen.getByText('↑')).not.toBeDisabled()
  })

  it('guarda mensaje en cola cuando offline', async () => {
    useNetwork.mockReturnValue({ isOnline: false })
    render(<MessagesPage />)
    const input = screen.getByPlaceholderText(/Offline/)
    fireEvent.change(input, { target: { value: 'Mensaje offline' } })
    fireEvent.click(screen.getByText('↑'))
    await waitFor(() => expect(db.messages.add).toHaveBeenCalled())
    expect(queueManager.enqueue).toHaveBeenCalledWith('SEND_MESSAGE', expect.objectContaining({ content: 'Mensaje offline' }))
  })

  it('envía mensaje al servidor cuando online', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false }) // fetchFromServer
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'srv-1', roomId: 'general', content: 'Test', author: 'Yo', createdAt: TODAY_ISO })
      })
    )
    render(<MessagesPage />)
    const input = screen.getByPlaceholderText(/Escribe un mensaje/)
    fireEvent.change(input, { target: { value: 'Test' } })
    fireEvent.click(screen.getByText('↑'))
    await waitFor(() => expect(db.messages.add).toHaveBeenCalled())
  })

  it('muestra el nombre del autor por defecto', () => {
    render(<MessagesPage />)
    expect(screen.getByText(/Yo ✎/)).toBeInTheDocument()
  })

  it('permite editar el nombre del autor', async () => {
    render(<MessagesPage />)
    fireEvent.click(screen.getByText(/Yo ✎/))
    const authorInput = screen.getByDisplayValue('Yo')
    fireEvent.change(authorInput, { target: { value: 'Carlos' } })
    fireEvent.click(screen.getByText('OK'))
    await waitFor(() => expect(screen.getByText(/Carlos ✎/)).toBeInTheDocument())
  })

  it('cancela edición del autor con Escape', async () => {
    render(<MessagesPage />)
    fireEvent.click(screen.getByText(/Yo ✎/))
    const authorInput = screen.getByDisplayValue('Yo')
    fireEvent.change(authorInput, { target: { value: 'Otro' } })
    fireEvent.keyDown(authorInput, { key: 'Escape' })
    await waitFor(() => expect(screen.getByText(/Yo ✎/)).toBeInTheDocument())
  })

  it('muestra indicador "pendiente" en mensajes no sincronizados', () => {
    useLiveQuery.mockReturnValue([
      { id: 1, roomId: 'general', content: 'Sin sync', author: 'Yo', createdAt: TODAY_ISO, synced: false }
    ])
    render(<MessagesPage />)
    expect(screen.getByText(/pendiente/)).toBeInTheDocument()
  })

  it('envía mensaje al presionar Enter', async () => {
    render(<MessagesPage />)
    const input = screen.getByPlaceholderText(/Escribe un mensaje/)
    fireEvent.change(input, { target: { value: 'Mensaje Enter' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
    await waitFor(() => expect(db.messages.add).toHaveBeenCalled())
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CachePage from '../../pages/CachePage'

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}))

vi.mock('../../lib/db', () => ({
  db: {
    pages: { orderBy: vi.fn() },
    files: { orderBy: vi.fn(), delete: vi.fn() },
  },
  cacheManager: {
    savePage: vi.fn().mockResolvedValue({ size: 500, originalSize: 1000, ratio: 50 }),
    getPage: vi.fn().mockResolvedValue({ html: '<html><body>Hola</body></html>' }),
    deletePage: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../hooks/useNetwork', () => ({
  useNetwork: vi.fn(() => ({ isOnline: true })),
}))

vi.mock('../../hooks/usePredictor', () => ({
  usePredictor: vi.fn(() => ({
    logAccess: vi.fn(),
    shouldPrefetch: vi.fn().mockResolvedValue(false),
  })),
}))

import { useLiveQuery } from 'dexie-react-hooks'
import { useNetwork } from '../../hooks/useNetwork'
import { cacheManager } from '../../lib/db'

const SAMPLE_PAGES = [
  { id: 'https://example.com', title: 'Example', size: 1024, cachedAt: Date.now() },
  { id: 'https://test.org', title: 'Test Site', size: 2048, cachedAt: Date.now() },
]
const SAMPLE_FILES = [
  { id: 1, name: 'documento.pdf', type: 'application/pdf', size: 512000, cachedAt: Date.now() },
  { id: 2, name: 'imagen.png', type: 'image/png', size: 204800, cachedAt: Date.now() },
]

// Stable mock: uses fn.toString() to detect which query is being made
function withData(pages = SAMPLE_PAGES, files = SAMPLE_FILES) {
  useLiveQuery.mockImplementation(fn => {
    const str = fn?.toString() ?? ''
    if (str.includes('db.pages')) return pages
    if (str.includes('db.files')) return files
    return []
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useNetwork.mockReturnValue({ isOnline: true })
  withData()
})

describe('CachePage', () => {
  it('muestra las tabs de Páginas y Archivos', () => {
    render(<CachePage />)
    expect(screen.getByText(/Páginas/)).toBeInTheDocument()
    expect(screen.getByText(/Archivos/)).toBeInTheDocument()
  })

  it('muestra la lista de páginas guardadas por defecto', () => {
    render(<CachePage />)
    expect(screen.getByText('Example')).toBeInTheDocument()
    expect(screen.getByText('Test Site')).toBeInTheDocument()
  })

  it('muestra la lista de archivos al cambiar de tab', () => {
    render(<CachePage />)
    fireEvent.click(screen.getByText(/Archivos/))
    expect(screen.getByText('documento.pdf')).toBeInTheDocument()
    expect(screen.getByText('imagen.png')).toBeInTheDocument()
  })

  it('el botón Guardar está deshabilitado cuando se está offline', () => {
    useNetwork.mockReturnValue({ isOnline: false })
    render(<CachePage />)
    expect(screen.getByText('Guardar')).toBeDisabled()
  })

  it('el botón Guardar está activo cuando se está online', () => {
    render(<CachePage />)
    expect(screen.getByText('Guardar')).not.toBeDisabled()
  })

  it('muestra error con URL inválida', async () => {
    render(<CachePage />)
    const input = screen.getByPlaceholderText(/https:\/\/ejemplo/)
    fireEvent.change(input, { target: { value: 'no-es-url' } })
    fireEvent.click(screen.getByText('Guardar'))
    expect(await screen.findByText(/URL inválida/)).toBeInTheDocument()
  })

  it('muestra el buscador cuando hay páginas', () => {
    render(<CachePage />)
    expect(screen.getByPlaceholderText(/Buscar/)).toBeInTheDocument()
  })

  it('el buscador filtra páginas por título', () => {
    render(<CachePage />)
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: 'Example' } })
    expect(screen.getByText('Example')).toBeInTheDocument()
    expect(screen.queryByText('Test Site')).not.toBeInTheDocument()
  })

  it('el buscador filtra páginas por URL', () => {
    render(<CachePage />)
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: 'test.org' } })
    expect(screen.queryByText('Example')).not.toBeInTheDocument()
    expect(screen.getByText('Test Site')).toBeInTheDocument()
  })

  it('el buscador filtra archivos por nombre', () => {
    render(<CachePage />)
    fireEvent.click(screen.getByText(/Archivos/))
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: 'pdf' } })
    expect(screen.getByText('documento.pdf')).toBeInTheDocument()
    expect(screen.queryByText('imagen.png')).not.toBeInTheDocument()
  })

  it('muestra mensaje "sin resultados" cuando el filtro no coincide', () => {
    render(<CachePage />)
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: 'zzznomatch' } })
    expect(screen.getByText(/Sin resultados/)).toBeInTheDocument()
  })

  it('limpiar la búsqueda restaura todos los resultados', () => {
    render(<CachePage />)
    const search = screen.getByPlaceholderText(/Buscar/)
    fireEvent.change(search, { target: { value: 'Example' } })
    expect(screen.queryByText('Test Site')).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByText('Test Site')).toBeInTheDocument()
  })

  it('abre el visor al hacer click en una página', async () => {
    render(<CachePage />)
    fireEvent.click(screen.getAllByTitle('Abrir')[0])
    expect(await screen.findByText(/Cerrar/)).toBeInTheDocument()
  })

  it('el visor se cierra al hacer click en Cerrar', async () => {
    render(<CachePage />)
    fireEvent.click(screen.getAllByTitle('Abrir')[0])
    fireEvent.click(await screen.findByText(/Cerrar/))
    expect(screen.queryByText(/Cerrar/)).not.toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay páginas', () => {
    withData([], [])
    render(<CachePage />)
    expect(screen.getByText('Ninguna página guardada aún')).toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay archivos', () => {
    withData([], [])
    render(<CachePage />)
    fireEvent.click(screen.getByText(/Archivos/))
    expect(screen.getByText('Ningún archivo guardado aún')).toBeInTheDocument()
  })

  it('llama deletePage al hacer click en eliminar página', () => {
    render(<CachePage />)
    fireEvent.click(screen.getAllByText('✕')[0])
    expect(cacheManager.deletePage).toHaveBeenCalledWith('https://example.com')
  })

  it('no muestra el buscador cuando no hay datos', () => {
    withData([], [])
    render(<CachePage />)
    expect(screen.queryByPlaceholderText(/Buscar/)).not.toBeInTheDocument()
  })
})

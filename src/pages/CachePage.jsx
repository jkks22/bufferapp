import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, cacheManager } from '../lib/db'
import { useNetwork } from '../hooks/useNetwork'
import { usePredictor } from '../hooks/usePredictor'
import './CachePage.css'

export default function CachePage() {
  const { isOnline } = useNetwork()
  const { logAccess, shouldPrefetch } = usePredictor()
  const [tab, setTab] = useState('pages')
  const [urlInput, setUrlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [viewingPage, setViewingPage] = useState(null) // { title, html }
  const fileInputRef = useRef()

  const [search, setSearch] = useState('')

  const pages = useLiveQuery(() => db.pages.orderBy('cachedAt').reverse().toArray(), []) ?? []
  const files = useLiveQuery(() => db.files.orderBy('cachedAt').reverse().toArray(), []) ?? []

  const filteredPages = search.trim()
    ? pages.filter(p =>
        p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.id?.toLowerCase().includes(search.toLowerCase())
      )
    : pages

  const filteredFiles = search.trim()
    ? files.filter(f => f.name?.toLowerCase().includes(search.toLowerCase()))
    : files

  // Guarda una página web
  function isValidUrl(str) {
    try {
      const url = new URL(str)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  async function cachePage() {
    if (!urlInput.trim()) return
    if (!isValidUrl(urlInput.trim())) { setError('URL inválida. Debe comenzar con http:// o https://'); return }
    if (!isOnline) { setError('Sin conexión — no puedes descargar nuevas páginas'); return }
    setLoading(true)
    setError('')
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlInput)}`
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const html = await res.text()
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim() : urlInput
      await cacheManager.savePage(urlInput, html, title)
      await logAccess(urlInput, 'page')
      setUrlInput('')
    } catch (e) {
      setError('No se pudo descargar la página. ¿Es una URL válida?')
    } finally {
      setLoading(false)
    }
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

  // Genera thumbnail 80x80 para imágenes
  async function generateThumbnail(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 80
        const ratio = Math.min(size / img.width, size / img.height)
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    })
  }

  // Guarda un archivo en IndexedDB
  async function saveFile(file) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`"${file.name}" supera el límite de 50 MB`)
    }
    const isImage = file.type.startsWith('image/')
    const thumbnail = isImage ? await generateThumbnail(file) : null

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          await db.files.add({
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            data: e.target.result, // ArrayBuffer
            thumbnail,
            cachedAt: Date.now(),
            status: 'cached'
          })
          await logAccess(file.name, 'file')
          resolve()
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  // Maneja archivos soltados con drag & drop
  async function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length === 0) return
    setLoading(true)
    setError('')
    try {
      for (const file of droppedFiles) {
        await saveFile(file)
      }
    } catch (err) {
      setError(err.message || 'Error al guardar algún archivo.')
    } finally {
      setLoading(false)
    }
  }

  // Maneja archivos seleccionados con el input
  async function handleFileInput(e) {
    const selectedFiles = Array.from(e.target.files)
    if (selectedFiles.length === 0) return
    setLoading(true)
    setError('')
    try {
      for (const file of selectedFiles) {
        await saveFile(file)
      }
    } catch (err) {
      setError(err.message || 'Error al guardar algún archivo.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  // Abre una página guardada en el visor
  async function openPage(page) {
    const full = await cacheManager.getPage(page.id)
    if (!full) return
    await logAccess(page.id, 'page')
    setViewingPage({ title: page.title, html: full.html })
  }

  // Exporta una página como archivo .html
  async function exportPage(page) {
    const full = await cacheManager.getPage(page.id)
    if (!full) return
    const blob = new Blob([full.html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${page.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Descarga un archivo guardado
  function downloadFile(file) {
    const blob = new Blob([file.data], { type: file.type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }

  function formatSize(bytes) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleString('es-MX', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  function getFileIcon(type) {
    if (type.includes('pdf')) return '📕'
    if (type.includes('image')) return '🖼️'
    if (type.includes('video')) return '🎬'
    if (type.includes('audio')) return '🎵'
    if (type.includes('zip') || type.includes('rar')) return '🗜️'
    if (type.includes('word') || type.includes('document')) return '📝'
    if (type.includes('sheet') || type.includes('excel')) return '📊'
    return '📄'
  }

  return (
    <div className="cache-page">
      <h2 className="page-title">Caché</h2>

      <div className="tabs">
        <button className={`tab ${tab === 'pages' ? 'active' : ''}`} onClick={() => setTab('pages')}>
          Páginas ({pages.length})
        </button>
        <button className={`tab ${tab === 'files' ? 'active' : ''}`} onClick={() => setTab('files')}>
          Archivos ({files.length})
        </button>
      </div>

      {/* Buscador */}
      {(pages.length > 0 || files.length > 0) && (
        <input
          className="search-input"
          placeholder="Buscar por nombre o URL..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}

      {/* Guardar página */}
      {tab === 'pages' && (
        <div className="url-form">
          <input
            className="url-input"
            placeholder="https://ejemplo.com/articulo"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && cachePage()}
            disabled={loading}
          />
          <button className="btn-save" onClick={cachePage} disabled={loading || !isOnline}>
            {loading ? '...' : 'Guardar'}
          </button>
        </div>
      )}

      {/* Zona de drag & drop para archivos */}
      {tab === 'files' && (
        <div
          className={`dropzone ${dragging ? 'dragging' : ''} ${loading ? 'loading' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          <div className="dropzone-icon">{loading ? '⏳' : '📂'}</div>
          <div className="dropzone-text">
            {loading
              ? 'Guardando archivos...'
              : dragging
              ? 'Suelta los archivos aquí'
              : 'Arrastra archivos aquí o toca para seleccionar'}
          </div>
          <div className="dropzone-sub">PDF, imágenes, documentos, videos y más</div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {/* Lista de páginas */}
      {tab === 'pages' && (
        <div className="item-list">
          {pages.length === 0 && <div className="empty-state">Ninguna página guardada aún</div>}
          {pages.length > 0 && filteredPages.length === 0 && <div className="empty-state">Sin resultados para "{search}"</div>}
          {filteredPages.map(page => (
            <div key={page.id} className="cache-item">
              <div className="item-body">
                <div className="item-name">{page.title}</div>
                <div className="item-meta">{formatSize(page.size)} · {formatDate(page.cachedAt)}</div>
                <div className="item-url">{page.id}</div>
              </div>
              <button className="btn-open" onClick={() => openPage(page)} title="Abrir">↗</button>
              <button className="btn-download" onClick={() => exportPage(page)} title="Descargar HTML">↓</button>
              <button className="btn-delete" onClick={() => cacheManager.deletePage(page.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Lista de archivos */}
      {tab === 'files' && (
        <div className="item-list">
          {files.length === 0 && <div className="empty-state">Ningún archivo guardado aún</div>}
          {files.length > 0 && filteredFiles.length === 0 && <div className="empty-state">Sin resultados para "{search}"</div>}
          {filteredFiles.map(file => (
            <div key={file.id} className="cache-item">
              {file.thumbnail
                ? <img src={file.thumbnail} className="item-thumbnail" alt={file.name} />
                : <div className="item-icon">{getFileIcon(file.type)}</div>
              }
              <div className="item-body">
                <div className="item-name">{file.name}</div>
                <div className="item-meta">{formatSize(file.size)} · {formatDate(file.cachedAt)}</div>
              </div>
              <button className="btn-download" onClick={() => downloadFile(file)} title="Descargar">↓</button>
              <button className="btn-delete" onClick={() => db.files.delete(file.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      {viewingPage && (
        <div className="page-viewer-overlay">
          <div className="page-viewer-header">
            <span className="page-viewer-title">{viewingPage.title}</span>
            <button className="page-viewer-close" onClick={() => setViewingPage(null)}>✕ Cerrar</button>
          </div>
          <iframe
            className="page-viewer-frame"
            srcDoc={viewingPage.html}
            sandbox="allow-same-origin allow-scripts"
            title={viewingPage.title}
          />
        </div>
      )}
    </div>
  )
}
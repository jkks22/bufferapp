import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, cacheManager } from '../lib/db'
import { useNetwork } from '../hooks/useNetwork'
import './CachePage.css'

export default function CachePage() {
  const { isOnline } = useNetwork()
  const [tab, setTab] = useState('pages')
  const [urlInput, setUrlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pages = useLiveQuery(() => db.pages.orderBy('cachedAt').reverse().toArray(), []) ?? []
  const files = useLiveQuery(() => db.files.orderBy('cachedAt').reverse().toArray(), []) ?? []

  async function cachePage() {
    if (!urlInput.trim()) return
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
      setUrlInput('')
    } catch (e) {
      setError('No se pudo descargar la página. ¿Es una URL válida?')
    } finally {
      setLoading(false)
    }
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

      {error && <p className="form-error">{error}</p>}

      {tab === 'pages' && (
        <div className="item-list">
          {pages.length === 0 && <div className="empty-state">Ninguna página guardada aún</div>}
          {pages.map(page => (
            <div key={page.id} className="cache-item">
              <div className="item-body">
                <div className="item-name">{page.title}</div>
                <div className="item-meta">{formatSize(page.size)} · {formatDate(page.cachedAt)}</div>
                <div className="item-url">{page.id}</div>
              </div>
              <button className="btn-delete" onClick={() => cacheManager.deletePage(page.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'files' && (
        <div className="item-list">
          {files.length === 0 && <div className="empty-state">Ningún archivo guardado aún</div>}
          {files.map(file => (
            <div key={file.id} className="cache-item">
              <div className="item-icon">📄</div>
              <div className="item-body">
                <div className="item-name">{file.name}</div>
                <div className="item-meta">{file.type} · {formatSize(file.size)} · {formatDate(file.cachedAt)}</div>
              </div>
              <button className="btn-delete" onClick={() => db.files.delete(file.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
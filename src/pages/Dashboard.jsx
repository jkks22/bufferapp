import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, cacheManager, queueManager } from '../lib/db'
import { useNetwork } from '../hooks/useNetwork'
import { usePredictor } from '../hooks/usePredictor'
import './Dashboard.css'

const MAX_STORAGE_BYTES = 150 * 1024 * 1024

export default function Dashboard() {
  const { isOnline, signalStrength } = useNetwork()
  const { suggestions, weakHours, prefetching, lastPrefetched, autoPrefetchEnabled, toggleAutoPrefetch, formatHour } = usePredictor()
  const [totalSize, setTotalSize] = useState(0)
  const [compressionStats, setCompressionStats] = useState(null)

  const queueCount = useLiveQuery(() => queueManager.count(), []) ?? 0
  const cachedPages = useLiveQuery(() => db.pages.count(), []) ?? 0
  const cachedFiles = useLiveQuery(() => db.files.count(), []) ?? 0

  useEffect(() => {
    cacheManager.getTotalSize().then(setTotalSize)
    cacheManager.getCompressionStats().then(setCompressionStats)
  }, [cachedPages, cachedFiles])

  const storagePercent = Math.min(100, (totalSize / MAX_STORAGE_BYTES) * 100)
  const storageMB = (totalSize / 1024 / 1024).toFixed(1)
  const storageFull = storagePercent >= 100
  const storageWarning = storagePercent >= 80 && !storageFull

  async function handleClearOld() {
    const { deletedPages, deletedFiles } = await cacheManager.clearOldCache(30)
    if (deletedPages + deletedFiles === 0) {
      await cacheManager.clearOldCache(7)
    }
    cacheManager.getTotalSize().then(setTotalSize)
    cacheManager.getCompressionStats().then(setCompressionStats)
  }

  async function handleClearAll() {
    if (!window.confirm('¿Eliminar todo el caché? No se puede deshacer.')) return
    await cacheManager.clearAllCache()
    cacheManager.getTotalSize().then(setTotalSize)
    cacheManager.getCompressionStats().then(setCompressionStats)
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="dashboard">
      <div className="dash-header">
        <h1 className="dash-title">BufferApp</h1>
        <p className="dash-sub">Tu caché de ancho de banda</p>
      </div>

      <div className="storage-card">
        <div className="storage-top">
          <div>
            <div className="storage-mb">{storageMB} MB</div>
            <div className="storage-label">de 150 MB usados</div>
          </div>
          <div className="storage-pct">{Math.round(storagePercent)}%</div>
        </div>
        <div className="storage-bar">
          <div className="storage-fill" style={{ width: `${storagePercent}%` }} />
        </div>
      </div>

      {storageFull && (
        <div className="storage-alert full">
          <div className="storage-alert-title">⛔ Almacenamiento lleno</div>
          <p className="storage-alert-sub">No se pueden guardar más páginas ni archivos.</p>
          <div className="storage-alert-actions">
            <button className="btn-clear-old" onClick={handleClearOld}>Limpiar antiguo</button>
            <button className="btn-clear-all" onClick={handleClearAll}>Limpiar todo</button>
          </div>
        </div>
      )}

      {storageWarning && (
        <div className="storage-alert warn">
          <div className="storage-alert-title">⚠️ Almacenamiento casi lleno ({Math.round(storagePercent)}%)</div>
          <p className="storage-alert-sub">Considera eliminar páginas o archivos antiguos.</p>
          <div className="storage-alert-actions">
            <button className="btn-clear-old" onClick={handleClearOld}>Limpiar antiguo</button>
          </div>
        </div>
      )}

      {/* Stats de compresión */}
      {compressionStats && compressionStats.ratio > 0 && (
        <div className="compression-card">
          <div className="compression-title">🗜️ Compresión activa</div>
          <div className="compression-grid">
            <div className="compression-stat">
              <div className="compression-number">{compressionStats.ratio}%</div>
              <div className="compression-label">espacio ahorrado</div>
            </div>
            <div className="compression-stat">
              <div className="compression-number">{formatSize(compressionStats.saved)}</div>
              <div className="compression-label">bytes liberados</div>
            </div>
            <div className="compression-stat">
              <div className="compression-number">{formatSize(compressionStats.totalOriginal)}</div>
              <div className="compression-label">tamaño original</div>
            </div>
          </div>
        </div>
      )}

      <div className="signal-card">
        <div className="signal-title">Señal actual</div>
        <div className="signal-bars">
          {[1, 2, 3, 4].map(level => (
            <div
              key={level}
              className={`signal-bar ${signalStrength >= level ? 'active' : ''}`}
              style={{ height: `${10 + level * 6}px` }}
            />
          ))}
          <span className="signal-text">
            {isOnline
              ? ['', 'Débil', 'Normal', 'Buena', 'Excelente'][signalStrength]
              : 'Sin señal'}
          </span>
        </div>
        {signalStrength <= 1 && isOnline && (
          <p className="signal-warning">
            ⚠️ Señal débil — considera pre-descargar contenido ahora
          </p>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{cachedPages}</div>
          <div className="stat-label">páginas guardadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{cachedFiles}</div>
          <div className="stat-label">archivos guardados</div>
        </div>
        <div className={`stat-card ${queueCount > 0 ? 'stat-warning' : ''}`}>
          <div className="stat-number">{queueCount}</div>
          <div className="stat-label">acciones en cola</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{isOnline ? '🟢' : '🔴'}</div>
          <div className="stat-label">{isOnline ? 'conectado' : 'offline'}</div>
        </div>
      </div>

      {prefetching && (
        <div className="prefetch-banner">
          <div className="prefetch-spinner" />
          <span>Pre-descargando contenido frecuente...</span>
        </div>
      )}

      {lastPrefetched.length > 0 && (
        <div className="prefetched-banner">
          <div className="prefetched-title">✓ Pre-descargado automáticamente</div>
          {lastPrefetched.map(url => (
            <div key={url} className="prefetched-item">{url}</div>
          ))}
        </div>
      )}

      <div className="autoprefetch-row">
        <span className="autoprefetch-label">Pre-descarga automática</span>
        <button
          className={`toggle-btn ${autoPrefetchEnabled ? 'on' : 'off'}`}
          onClick={toggleAutoPrefetch}
        >
          {autoPrefetchEnabled ? 'Activada' : 'Desactivada'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="predictor-card">
          <div className="predictor-title">📊 Sugerencias del predictor</div>
          <p className="predictor-sub">Contenido que usas frecuentemente con poca señal</p>
          <div className="predictor-list">
            {suggestions.map(s => (
              <div key={s.resourceId} className="predictor-item">
                <span className="predictor-icon">
                  {s.resourceType === 'page' ? '🌐' : '📄'}
                </span>
                <span className="predictor-url">{s.resourceId}</span>
                <span className="predictor-count">{s.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {weakHours.length > 0 && (
        <div className="weak-hours-card">
          <div className="predictor-title">🕐 Horas con señal débil frecuente</div>
          <div className="weak-hours-list">
            {weakHours.map(({ hour, count }) => (
              <div key={hour} className="weak-hour-item">
                <span className="weak-hour-time">{formatHour(hour)}</span>
                <span className="weak-hour-count">{count} veces</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isOnline && queueCount > 0 && (
        <div className="queue-banner">
          <div className="queue-banner-title">
            {queueCount} acción{queueCount !== 1 ? 'es' : ''} en cola
          </div>
          <p className="queue-banner-sub">
            Se enviarán automáticamente al recuperar conexión.
          </p>
        </div>
      )}
    </div>
  )
}
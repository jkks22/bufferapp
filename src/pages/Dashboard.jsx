import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, cacheManager, queueManager } from '../lib/db'
import { useNetwork } from '../hooks/useNetwork'
import './Dashboard.css'

const MAX_STORAGE_BYTES = 150 * 1024 * 1024

export default function Dashboard() {
  const { isOnline, signalStrength } = useNetwork()
  const [totalSize, setTotalSize] = useState(0)

  const queueCount = useLiveQuery(() => queueManager.count(), []) ?? 0
  const cachedPages = useLiveQuery(() => db.pages.count(), []) ?? 0
  const cachedFiles = useLiveQuery(() => db.files.count(), []) ?? 0

  useEffect(() => {
    cacheManager.getTotalSize().then(setTotalSize)
  }, [cachedPages, cachedFiles])

  const storagePercent = Math.min(100, (totalSize / MAX_STORAGE_BYTES) * 100)
  const storageMB = (totalSize / 1024 / 1024).toFixed(1)

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
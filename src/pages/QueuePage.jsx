import { useLiveQuery } from 'dexie-react-hooks'
import { db, queueManager } from '../lib/db'
import { useNetwork } from '../hooks/useNetwork'
import { useSync } from '../hooks/useSync'
import './QueuePage.css'

const TYPE_LABELS = {
  HTTP_REQUEST: 'Petición HTTP',
  SEND_MESSAGE: 'Mensaje',
}

export default function QueuePage() {
  const { isOnline } = useNetwork()
  const { processQueue, syncing } = useSync()
  const queue = useLiveQuery(() => db.syncQueue.orderBy('createdAt').toArray(), []) ?? []

  function formatDate(ts) {
    return new Date(ts).toLocaleString('es-MX', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  async function addDemoItem() {
    await queueManager.enqueue('HTTP_REQUEST', {
      url: '/api/demo',
      method: 'POST',
      body: { message: 'Item de prueba', ts: Date.now() }
    })
  }

  async function clearAll() {
    await db.syncQueue.clear()
  }

  return (
    <div className="queue-page">
      <h2 className="page-title">Cola de sincronización</h2>

      <p className="queue-description">
        Las acciones que realizas sin señal se guardan aquí y se envían
        automáticamente al servidor cuando recuperas conexión.
      </p>

      <div className={`status-banner ${isOnline ? 'online' : 'offline'}`}>
        <div className="status-dot" />
        <span>
          {syncing
            ? 'Sincronizando...'
            : isOnline
            ? queue.length === 0
              ? 'Todo sincronizado'
              : `${queue.length} item(s) listos para sincronizar`
            : `Sin conexión — ${queue.length} item(s) en espera`}
        </span>
        {isOnline && queue.length > 0 && !syncing && (
          <button className="btn-sync" onClick={processQueue}>Sincronizar ahora</button>
        )}
        {syncing && <span className="syncing-spinner">⏳</span>}
      </div>

      <div className="queue-list">
        {queue.length === 0 && <div className="empty-state">La cola está vacía</div>}
        {queue.map(item => (
          <div key={item.id} className={`queue-item ${item.lastError ? 'has-error' : ''}`}>
            <div className="queue-type">{TYPE_LABELS[item.type] || item.type}</div>
            <div className="queue-payload">
              {item.payload?.url || item.payload?.message || 'sin detalle'}
            </div>
            <div className="queue-meta">
              {formatDate(item.createdAt)}
              {item.retries > 0 && (
                <span className="retry-badge">{item.retries} reintentos</span>
              )}
            </div>
            {item.lastError && (
              <div className="queue-error">✗ {item.lastError}</div>
            )}
            <button className="btn-remove" onClick={() => queueManager.dequeue(item.id)}>✕</button>
          </div>
        ))}
      </div>

      {import.meta.env.DEV && (
        <div className="dev-actions">
          <p className="dev-label">Modo desarrollo</p>
          <div className="dev-buttons">
            <button className="btn-dev" onClick={addDemoItem}>+ Agregar item de prueba</button>
            {queue.length > 0 && (
              <button className="btn-dev danger" onClick={clearAll}>Limpiar cola</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
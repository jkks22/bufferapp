import { useState, useEffect } from 'react'
import './UpdatePrompt.css'

export default function UpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then(registration => {
      // Si ya hay un SW esperando al cargar
      if (registration.waiting) {
        setWaitingWorker(registration.waiting)
        setShowPrompt(true)
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker)
            setShowPrompt(true)
          }
        })
      })
    })
  }, [])

  function handleUpdate() {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' })
    window.location.reload()
  }

  if (!showPrompt) return null

  return (
    <div className="update-prompt">
      <span className="update-text">Hay una nueva versión disponible</span>
      <div className="update-actions">
        <button className="update-btn" onClick={handleUpdate}>Actualizar</button>
        <button className="update-dismiss" onClick={() => setShowPrompt(false)}>Ahora no</button>
      </div>
    </div>
  )
}

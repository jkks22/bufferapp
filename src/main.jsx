import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {
      // Solicita almacenamiento persistente después de que el SW esté activo;
      // tener SW aumenta la probabilidad de que el navegador lo conceda automáticamente
      if ('storage' in navigator && 'persist' in navigator.storage) {
        navigator.storage.persist().catch(() => {})
      }
    }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
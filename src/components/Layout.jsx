import { NavLink } from 'react-router-dom'
import { useNetwork } from '../hooks/useNetwork'
import './Layout.css'

const SIGNAL_LABELS = ['Sin señal', 'Débil', 'Normal', 'Buena', 'Excelente']
const SIGNAL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981']

export default function Layout({ children }) {
  const { isOnline, signalStrength, effectiveType, downlink } = useNetwork()

  return (
    <div className="layout">
      <div
        className={`network-bar ${isOnline ? 'online' : 'offline'}`}
        style={{ '--signal-color': SIGNAL_COLORS[signalStrength] }}
      >
        <div className="network-dot" />
        <span className="network-label">
          {isOnline
            ? `${SIGNAL_LABELS[signalStrength]} · ${effectiveType.toUpperCase()} · ${downlink} Mbps`
            : 'Sin conexión — modo offline activo'}
        </span>
        {!isOnline && <span className="offline-badge">OFFLINE</span>}
      </div>

      <main className="main-content">
        {children}
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">⚡</span>
          <span className="nav-label">Dashboard</span>
        </NavLink>
        <NavLink to="/cache" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">📦</span>
          <span className="nav-label">Caché</span>
        </NavLink>
        <NavLink to="/queue" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">🔄</span>
          <span className="nav-label">Cola</span>
        </NavLink>
      </nav>
    </div>
  )
}
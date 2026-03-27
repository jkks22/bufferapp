import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={{ fontSize: '48px' }}>404</div>
      <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Esta página no existe.</p>
      <Link to="/" style={{ color: 'var(--accent)', fontSize: '14px' }}>← Volver al inicio</Link>
    </div>
  )
}

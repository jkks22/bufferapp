import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100dvh', gap: '16px',
          padding: '24px', textAlign: 'center', background: '#0f0f0f', color: '#f0f0f0'
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Algo salió mal</h2>
          <p style={{ color: '#888', fontSize: '14px', maxWidth: '320px' }}>
            {this.state.error?.message || 'Error inesperado en la aplicación.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/' }}
            style={{
              padding: '10px 24px', borderRadius: '8px', border: 'none',
              background: '#3b82f6', color: '#fff', fontSize: '14px',
              cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            Reiniciar app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

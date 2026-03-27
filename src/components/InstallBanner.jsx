import { usePWAInstall } from '../hooks/usePWAInstall'
import './InstallBanner.css'

export default function InstallBanner() {
  const { isInstallable, promptInstall } = usePWAInstall()

  if (!isInstallable) return null

  return (
    <div className="install-banner">
      <span className="install-text">Instala BufferApp para usarla sin conexión</span>
      <button className="install-btn" onClick={promptInstall}>Instalar</button>
    </div>
  )
}

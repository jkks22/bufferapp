import { useState, useEffect } from 'react'

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // La app ya está instalada si corre en modo standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    function onBeforeInstall(e) {
      e.preventDefault()
      setInstallPrompt(e)
    }

    function onAppInstalled() {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  async function promptInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setInstallPrompt(null)
  }

  return {
    isInstallable: !!installPrompt && !isInstalled,
    isInstalled,
    promptInstall,
  }
}

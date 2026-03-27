import { useState, useEffect } from 'react'
import { predictor } from '../lib/predictor'
import { useNetwork } from './useNetwork'

export function usePredictor() {
  const { signalStrength, isOnline } = useNetwork()
  const [suggestions, setSuggestions] = useState([])
  const [weakHours, setWeakHours] = useState([])
  const [prefetching, setPrefetching] = useState(false)
  const [lastPrefetched, setLastPrefetched] = useState([])
  const [autoPrefetchEnabled, setAutoPrefetchEnabled] = useState(
    () => localStorage.getItem('autoPrefetch') !== 'false'
  )

  function toggleAutoPrefetch() {
    setAutoPrefetchEnabled(prev => {
      localStorage.setItem('autoPrefetch', String(!prev))
      return !prev
    })
  }

  // Carga sugerencias al iniciar
  useEffect(() => {
    loadSuggestions()
  }, [])

  // Cuando mejora la señal, intenta pre-descargar automáticamente (si está activado)
  useEffect(() => {
    if (!autoPrefetchEnabled) return
    if (!isOnline) return
    if (signalStrength < 3) return
    if (prefetching) return

    autoPrefetch()
  }, [signalStrength, isOnline, autoPrefetchEnabled])

  async function loadSuggestions() {
    const [sugs, hours] = await Promise.all([
      predictor.getSuggestions(),
      predictor.getWeakSignalHours()
    ])
    setSuggestions(sugs)
    setWeakHours(hours)
  }

  async function autoPrefetch() {
    setPrefetching(true)
    try {
      const prefetched = await predictor.autoPrefetch(signalStrength)
      if (prefetched.length > 0) {
        setLastPrefetched(prefetched)
        await loadSuggestions()
      }
    } finally {
      setPrefetching(false)
    }
  }

  async function logAccess(resourceId, resourceType) {
    await predictor.logAccess(resourceId, resourceType, signalStrength)
    await loadSuggestions()
  }

  function formatHour(hour) {
    const ampm = hour >= 12 ? 'pm' : 'am'
    const h = hour % 12 || 12
    return `${h}:00 ${ampm}`
  }

  return {
    suggestions,
    weakHours,
    prefetching,
    lastPrefetched,
    autoPrefetchEnabled,
    toggleAutoPrefetch,
    logAccess,
    formatHour,
    shouldPrefetch: predictor.shouldPrefetch(signalStrength)
  }
}
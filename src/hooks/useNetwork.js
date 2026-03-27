import { useState, useEffect } from 'react'

function getSignalStrength(connection) {
  if (!navigator.onLine) return 0
  if (!connection) return 3

  const { effectiveType, downlink } = connection
  if (effectiveType === '4g' && downlink > 5) return 4
  if (effectiveType === '4g') return 3
  if (effectiveType === '3g') return 2
  if (effectiveType === '2g') return 1
  return 0
}

export function useNetwork() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection

  const [networkState, setNetworkState] = useState({
    isOnline: navigator.onLine,
    signalStrength: getSignalStrength(connection),
    effectiveType: connection?.effectiveType || 'unknown',
    downlink: connection?.downlink || 0,
    rtt: connection?.rtt || 0,
  })

  useEffect(() => {
    function updateState() {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
      setNetworkState({
        isOnline: navigator.onLine,
        signalStrength: getSignalStrength(conn),
        effectiveType: conn?.effectiveType || 'unknown',
        downlink: conn?.downlink || 0,
        rtt: conn?.rtt || 0,
      })
    }

    window.addEventListener('online', updateState)
    window.addEventListener('offline', updateState)
    if (connection) connection.addEventListener('change', updateState)

    return () => {
      window.removeEventListener('online', updateState)
      window.removeEventListener('offline', updateState)
      if (connection) connection.removeEventListener('change', updateState)
    }
  }, [])

  return networkState
}
import { useState, useEffect, useCallback } from 'react'

export function useStorageQuota() {
  const [state, setState] = useState({ usage: 0, quota: 0, persistent: null })

  const refresh = useCallback(async () => {
    if (!('storage' in navigator)) return
    const [est, persistent] = await Promise.all([
      navigator.storage.estimate().catch(() => ({ usage: 0, quota: 0 })),
      navigator.storage.persisted().catch(() => null),
    ])
    setState({ usage: est.usage || 0, quota: est.quota || 0, persistent })
  }, [])

  const requestPersist = useCallback(async () => {
    if (!('storage' in navigator && 'persist' in navigator.storage)) return false
    const granted = await navigator.storage.persist().catch(() => false)
    setState(s => ({ ...s, persistent: granted }))
    return granted
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { ...state, refresh, requestPersist }
}

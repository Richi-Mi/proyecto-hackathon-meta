import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { customerApi, getErrorMessage } from '@/lib/api/client'
import type { EntryPass } from '@/lib/api/types'
import { useEntryPassStore } from './entry-pass-store'

export type EntryPassStatus = 'loading' | 'ready' | 'error' | 'offline'

const subscribeToNetwork = (onChange: () => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Estado de la conexión del navegador como store externo de React. */
export const useOnline = () => useSyncExternalStore(subscribeToNetwork, () => navigator.onLine)

/**
 * Mantiene vigente el pase de entrada: lo pide al montar, lo renueva antes de que expire,
 * pausa mientras la app está en segundo plano y lo renueva al volver o al recuperar conexión.
 */
export function useEntryPass() {
  const pass = useEntryPassStore((state) => state.pass)
  const setPass = useEntryPassStore((state) => state.setPass)
  const clear = useEntryPassStore((state) => state.clear)
  const online = useOnline()
  const [status, setStatus] = useState<Exclude<EntryPassStatus, 'offline'>>('loading')
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return
    try {
      const { data } = await customerApi.get<EntryPass>('/me/entry-pass')
      setPass(data)
      setStatus('ready')
    } catch (cause) {
      setError(getErrorMessage(cause))
      setStatus('error')
    }
  }, [setPass])

  // Primer pase y limpieza al salir de la pantalla
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refresh solo cambia estado tras el await de la petición
    void refresh()
    return clear
  }, [refresh, clear])

  // Renovación programada (solo con la app visible)
  const refreshAt = pass?.refreshAt
  useEffect(() => {
    if (!refreshAt) return
    const timeout = setTimeout(() => {
      if (!document.hidden) void refresh()
    }, Math.max(0, refreshAt - Date.now()))
    return () => clearTimeout(timeout)
  }, [refreshAt, refresh])

  // Volver a la app o recuperar conexión → pase fresco si el actual ya no sirve
  useEffect(() => {
    const onReturn = () => {
      const current = useEntryPassStore.getState().pass
      if (!document.hidden && (!current || current.refreshAt <= Date.now())) void refresh()
    }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('online', onReturn)
    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('online', onReturn)
    }
  }, [refresh])

  return { pass, status: (online ? status : 'offline') as EntryPassStatus, error, refresh }
}

/** Fecha actual que se actualiza cada `intervalMs` (cuenta regresiva). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])
  return now
}

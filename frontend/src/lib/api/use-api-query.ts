import { useEffect, useEffectEvent, useState } from 'react'

interface QueryResult<T> {
  key: string
  data?: T
  error?: unknown
}

/**
 * Carga datos al montar y cada vez que cambian `deps`; cancela la petición anterior.
 * Conserva los datos previos mientras recarga (sin parpadeos en tablas).
 */
export function useApiQuery<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[]) {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<QueryResult<T>>()
  const key = JSON.stringify([...deps, version])
  const load = useEffectEvent((signal: AbortSignal) => fetcher(signal))

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).then(
      (data) => setResult({ key, data }),
      (error: unknown) => {
        if (!controller.signal.aborted) setResult((previous) => ({ key, data: previous?.data, error }))
      },
    )
    return () => controller.abort()
  }, [key])

  return {
    data: result?.data,
    error: result?.key === key ? result.error : undefined,
    loading: result?.key !== key,
    reload: () => setVersion((current) => current + 1),
  }
}

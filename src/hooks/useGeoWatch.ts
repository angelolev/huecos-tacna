import { useCallback, useEffect, useState } from 'react'
import type { LatLng } from '../lib/types'

export type GeoFix = LatLng & { accuracy: number; at: number }
export type GeoError = 'insecure' | 'unsupported' | 'denied' | 'unavailable' | 'timeout'

/** Precisión (m) a partir de la cual dejamos de escuchar el GPS. */
const GOOD_ACCURACY_M = 15
/** Tiempo máximo escuchando el GPS para afinar la posición. */
const MAX_WATCH_MS = 30000

interface GeoState {
  fix: GeoFix | null
  watching: boolean
  error: GeoError | null
}

/**
 * Sigue el GPS con `watchPosition` y se queda con la lectura más precisa.
 * La primera lectura del celular suele venir de antenas/WiFi (cientos de metros de error);
 * las siguientes, del GPS real, llegan a unos pocos metros.
 */
export function useGeoWatch(enabled: boolean) {
  const [state, setState] = useState<GeoState>({ fix: null, watching: false, error: null })
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (!enabled) return
    if (!window.isSecureContext) {
      setState((s) => ({ ...s, error: 'insecure' }))
      return
    }
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'unsupported' }))
      return
    }

    let best: GeoFix | null = null
    let active = true
    setState((s) => ({ ...s, watching: true, error: null }))

    const stop = () => {
      if (!active) return
      active = false
      navigator.geolocation.clearWatch(id)
      clearTimeout(timer)
      setState((s) => ({ ...s, watching: false }))
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: GeoFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: pos.timestamp,
        }
        // Nos quedamos con la más precisa; si la mejor ya es vieja (la persona se movió), aceptamos la nueva.
        if (!best || fix.accuracy <= best.accuracy || fix.at - best.at > 10000) {
          best = fix
          setState((s) => ({ ...s, fix, error: null }))
        }
        if (fix.accuracy <= GOOD_ACCURACY_M) stop()
      },
      (err) => {
        const error: GeoError = err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable'
        if (error === 'denied') {
          setState((s) => ({ ...s, error }))
          stop()
        } else if (!best) {
          // Si ya tenemos una lectura, un timeout intermedio no importa.
          setState((s) => ({ ...s, error }))
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
    const timer = setTimeout(stop, MAX_WATCH_MS)

    return () => {
      active = false
      navigator.geolocation.clearWatch(id)
      clearTimeout(timer)
    }
  }, [enabled, run])

  const restart = useCallback(() => setRun((n) => n + 1), [])
  return { ...state, restart }
}

export type GeoWatch = ReturnType<typeof useGeoWatch>

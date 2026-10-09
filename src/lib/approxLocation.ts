import type { LatLng } from './types'

/** Ubicación aproximada por IP (nivel ciudad), de /api/geo. */
export interface ApproxLocation extends LatLng {
  city: string | null
  region: string | null
  /** Código de país ISO, p. ej. "PE". */
  country: string | null
}

const KEY = 'huecazo:approx-location'

let pending: Promise<ApproxLocation | null> | null = null

/** Lo que ya se sabe en esta sesión, sin esperar a la red. */
export function cachedApproxLocation(): ApproxLocation | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ApproxLocation) : null
  } catch {
    return null
  }
}

/**
 * Pide la ubicación aproximada una sola vez por sesión. Devuelve `null` si no se pudo
 * (en desarrollo no existe /api/geo: Vite responde con el index.html).
 */
export function getApproxLocation(): Promise<ApproxLocation | null> {
  const cached = cachedApproxLocation()
  if (cached) return Promise.resolve(cached)
  pending ??= fetch('/api/geo')
    .then((res) => (res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null))
    .then((data: ApproxLocation | null) => {
      if (!data || !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return null
      try {
        sessionStorage.setItem(KEY, JSON.stringify(data))
      } catch {
        /* sin almacenamiento: se vuelve a pedir en la próxima carga */
      }
      return data
    })
    .catch(() => null)
  return pending
}

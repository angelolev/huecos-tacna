import type { LatLng } from './types'

export function getCurrentPosition(): Promise<LatLng & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Tu navegador no soporta geolocalización'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

export function googleMapsLink({ lat, lng }: LatLng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

export function formatCoords({ lat, lng }: LatLng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

/** Radio de "cerca de mí" en el mapa principal. */
export const NEAR_RADIUS_M = 500

/** Zona urbana de Tacna (Alto de la Alianza, Ciudad Nueva, Pocollay, Gregorio Albarracín, Cercado). */
export const TACNA_CITY_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: -17.965,
  south: -18.07,
  east: -70.2,
  west: -70.31,
}

/** Rectángulo que contiene un círculo de `radiusM` metros alrededor de `center`. */
export function boundsAround({ lat, lng }: LatLng, radiusM: number): google.maps.LatLngBoundsLiteral {
  const dLat = radiusM / 111320
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180))
  return { north: lat + dLat, south: lat - dLat, east: lng + dLng, west: lng - dLng }
}

/** Distancia en metros entre dos puntos (fórmula de haversine). */
export function metersBetween(a: LatLng, b: LatLng) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

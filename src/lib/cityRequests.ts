import { collection, doc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import { slugify } from './cities'
import type { LatLng } from './types'

/** Lugar con nombre legible ("Arequipa", "Arequipa", "PE"). */
export interface Place {
  place: string
  region: string
  /** Código de país ISO, p. ej. "PE". */
  country: string
}

/**
 * Pedido de un vecino para que Huecazo llegue a su ciudad (`cityRequests/{uid}_{lugar}`).
 * Un documento por persona y lugar: volver a pedirlo solo actualiza la fecha.
 */
export interface CityRequest extends Place, LatLng {
  id: string
  uid: string
  /** De dónde salió la ubicación: GPS del celular o IP de la conexión (aproximada). */
  source: 'gps' | 'ip'
  requestedAt: Date | null
}

const requestsCol = collection(db, 'cityRequests')

/**
 * Clave del lugar: agrupa los pedidos de la misma ciudad ("arequipa-pe"). Sin la región: la que da
 * Google (GPS) y la que da la IP no se escriben igual.
 */
export function placeKey(p: Pick<Place, 'place' | 'country'>) {
  return slugify(`${p.place} ${p.country}`) || 'zona'
}

/** Guardamos el punto con ~1 km de precisión: basta para ubicar la ciudad, no la casa de nadie. */
const coarse = (n: number) => Math.round(n * 100) / 100

export async function requestCity(uid: string, point: LatLng, place: Place, source: CityRequest['source']) {
  await setDoc(doc(requestsCol, `${uid}_${placeKey(place)}`), {
    uid,
    place: place.place.slice(0, 80),
    region: place.region.slice(0, 80),
    country: place.country.slice(0, 60),
    lat: coarse(point.lat),
    lng: coarse(point.lng),
    source,
    requestedAt: serverTimestamp(),
  })
}

/** Solo admins (según las reglas). */
export function subscribeCityRequests(onData: (requests: CityRequest[]) => void, onError: (err: Error) => void) {
  return onSnapshot(
    requestsCol,
    (snap) =>
      onData(
        snap.docs
          .map((d) => {
            const r = d.data({ serverTimestamps: 'estimate' })
            return {
              id: d.id,
              uid: r.uid,
              place: r.place ?? '',
              region: r.region ?? '',
              country: r.country ?? '',
              lat: r.lat,
              lng: r.lng,
              source: r.source === 'gps' ? 'gps' : 'ip',
              requestedAt: r.requestedAt ? (r.requestedAt as Timestamp).toDate() : null,
            } satisfies CityRequest
          })
          .sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0)),
      ),
    onError,
  )
}

/** Descarta pedidos ya atendidos (solo admins). */
export async function deleteCityRequests(ids: string[]) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db)
    ids.slice(i, i + 400).forEach((id) => batch.delete(doc(requestsCol, id)))
    await batch.commit()
  }
}

import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { boundsArea, boundsContain } from './geo'
import type { Bounds, City, LatLng, Report } from './types'

const citiesCol = collection(db, 'cities')

const toBounds = (b: Record<string, number> | undefined): Bounds => ({
  north: b?.north ?? 0,
  south: b?.south ?? 0,
  east: b?.east ?? 0,
  west: b?.west ?? 0,
})

export function subscribeCities(onData: (cities: City[]) => void, onError: (err: Error) => void) {
  return onSnapshot(
    citiesCol,
    (snap) =>
      onData(
        snap.docs
          .map((d) => {
            const c = d.data()
            return {
              id: d.id,
              name: c.name,
              department: c.department ?? '',
              enabled: !!c.enabled,
              bounds: toBounds(c.bounds),
              viewBounds: toBounds(c.viewBounds ?? c.bounds),
              center: c.center,
              order: c.order ?? 99,
            } satisfies City
          })
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es')),
      ),
    onError,
  )
}

/** Ciudad cuya zona contiene el punto; si hay varias (zonas superpuestas), la más pequeña. */
export function findCityFor(point: LatLng, cities: City[]) {
  return (
    cities
      .filter((c) => boundsContain(c.bounds, point))
      .sort((a, b) => boundsArea(a.bounds) - boundsArea(b.bounds))[0] ?? null
  )
}

/** "Lima Metropolitana" → "lima-metropolitana" (id del documento). */
export function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export async function cityExists(id: string) {
  return (await getDoc(doc(citiesCol, id))).exists()
}

/** Crea o reemplaza una ciudad (solo admins, según las reglas). */
export async function saveCity(city: City, isNew: boolean) {
  const { id, ...data } = city
  await setDoc(doc(citiesCol, id), {
    ...data,
    ...(isNew ? { createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  }, { merge: !isNew })
}

export async function setCityEnabled(id: string, enabled: boolean) {
  await updateDoc(doc(citiesCol, id), { enabled, updatedAt: serverTimestamp() })
}

/**
 * Asigna `cityId` a los reportes creados antes de existir las ciudades.
 * Devuelve cuántos reportes se actualizaron.
 */
export async function backfillReportCities(reports: Report[], cities: City[]) {
  const pending = reports
    .filter((r) => !r.cityId)
    .map((r) => ({ id: r.id, city: findCityFor(r, cities) }))
    .filter((r) => r.city)
  // Firestore permite hasta 500 escrituras por lote.
  for (let i = 0; i < pending.length; i += 400) {
    const batch = writeBatch(db)
    pending.slice(i, i + 400).forEach((r) => batch.update(doc(db, 'reports', r.id), { cityId: r.city!.id }))
    await batch.commit()
  }
  return pending.length
}

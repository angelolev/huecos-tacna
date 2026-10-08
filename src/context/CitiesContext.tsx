import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { findCityFor, subscribeCities } from '../lib/cities'
import { TACNA_CITY } from '../lib/types'
import type { City, LatLng } from '../lib/types'

interface CitiesValue {
  /** Todas las ciudades (activas y pausadas). */
  cities: City[]
  /** Ciudades donde hoy se puede reportar. */
  enabledCities: City[]
  /** Ciudad por defecto: la primera activa (para quien está fuera de cualquier ciudad). */
  defaultCity: City
  /** `false` mientras no exista ningún documento en `cities` (el admin lo crea al entrar). */
  seeded: boolean
  loading: boolean
  /** Ciudad activa que contiene el punto, o `null` si Huecazo aún no funciona ahí. */
  enabledCityFor: (point: LatLng) => City | null
  cityName: (id: string | null) => string
}

const CitiesContext = createContext<CitiesValue | null>(null)

export function CitiesProvider({ children }: { children: ReactNode }) {
  const [remote, setRemote] = useState<City[] | null>(null)

  useEffect(
    () =>
      subscribeCities(setRemote, (err) => {
        console.error('No se pudieron cargar las ciudades', err)
        setRemote([])
      }),
    [],
  )

  // Mientras la colección esté vacía, Tacna funciona como respaldo para que la app no se rompa.
  const seeded = !!remote && remote.length > 0
  const cities = useMemo(() => (seeded ? remote! : [TACNA_CITY]), [seeded, remote])
  const enabledCities = useMemo(() => cities.filter((c) => c.enabled), [cities])

  const enabledCityFor = useCallback((point: LatLng) => findCityFor(point, enabledCities), [enabledCities])
  const cityName = useCallback((id: string | null) => cities.find((c) => c.id === id)?.name ?? 'Sin ciudad', [cities])

  const value: CitiesValue = {
    cities,
    enabledCities,
    defaultCity: enabledCities[0] ?? cities[0] ?? TACNA_CITY,
    seeded,
    loading: remote === null,
    enabledCityFor,
    cityName,
  }

  return <CitiesContext.Provider value={value}>{children}</CitiesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCities() {
  const ctx = useContext(CitiesContext)
  if (!ctx) throw new Error('useCities debe usarse dentro de <CitiesProvider>')
  return ctx
}

/** "Tacna", "Tacna y Moquegua", "Tacna, Moquegua y Lima". */
// eslint-disable-next-line react-refresh/only-export-components
export function listCityNames(cities: City[]) {
  const names = cities.map((c) => c.name)
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
}

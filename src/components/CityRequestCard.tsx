import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, Info, ListChecks, LoaderCircle, MapPinOff } from 'lucide-react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useAuth } from '../context/AuthContext'
import { placeKey, requestCity } from '../lib/cityRequests'
import type { Place } from '../lib/cityRequests'
import type { ApproxLocation } from '../lib/approxLocation'
import { trackEvent } from '../lib/analytics'
import { haptic } from '../lib/fx'
import type { LatLng } from '../lib/types'

const doneKey = (p: Place) => `huecazo:city-request:${placeKey(p)}`

function wasRequested(p: Place) {
  try {
    return !!localStorage.getItem(doneKey(p))
  } catch {
    return false
  }
}

const cleanRegion = (s: string) => s.replace(/^(Departamento|Provincia|Región|Region) de /i, '').trim()

/** Nombre del lugar a partir del GPS (Google) o, si no, de la IP. */
function usePlace(point: LatLng, source: 'gps' | 'ip', approx: ApproxLocation | null): Place & { named: boolean } {
  const geocodingLib = useMapsLibrary('geocoding')
  const fromIp: Place | null = approx?.city
    ? // La región de la IP viene como código ("ARE"): no aporta al admin.
      { place: approx.city, region: '', country: approx.country ?? '' }
    : null
  const [geocoded, setGeocoded] = useState<{ key: string; place: Place } | null>(null)
  // ~1 km: no volvemos a consultar a Google por cada lectura del GPS.
  const key = `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`
  const asked = useRef<string | null>(null)

  useEffect(() => {
    if (source !== 'gps' || !geocodingLib || asked.current === key) return
    asked.current = key
    new geocodingLib.Geocoder()
      .geocode({ location: point })
      .then(({ results }) => {
        const all = results.flatMap((r) => r.address_components)
        const find = (type: string) => all.find((a) => a.types.includes(type))
        const city = find('locality') ?? find('administrative_area_level_3') ?? find('administrative_area_level_2')
        const region = find('administrative_area_level_1')
        if (!city) return
        setGeocoded({
          key,
          place: {
            place: city.long_name,
            region: region ? cleanRegion(region.long_name) : '',
            country: find('country')?.short_name ?? '',
          },
        })
      })
      .catch((e) => console.error('No se pudo obtener el nombre de la ciudad', e))
  }, [source, geocodingLib, key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (geocoded?.key === key) return { ...geocoded.place, named: true }
  if (fromIp) return { ...fromIp, named: true }
  // Sin nombre: el admin la ubica por sus coordenadas.
  return { place: `Zona ${point.lat.toFixed(2)}, ${point.lng.toFixed(2)}`, region: '', country: '', named: false }
}

/**
 * Tarjeta para quien está fuera de las ciudades activas: le dice que su ciudad aún no está
 * activa y le permite pedir que la activen (le llega al admin en su panel).
 */
export function CityRequestCard({
  point,
  source,
  approx,
  activeCities,
  onShowCities,
}: {
  /** Dónde está la persona (GPS o, si no hay, IP). */
  point: LatLng
  source: 'gps' | 'ip'
  approx: ApproxLocation | null
  /** "Tacna y Moquegua". */
  activeCities: string
  onShowCities: () => void
}) {
  const { user } = useAuth()
  const { named, ...place } = usePlace(point, source, approx)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>(() => (wasRequested(place) ? 'done' : 'idle'))

  // Si el nombre del lugar cambia (el GPS afinó o la persona se movió), revisamos si ya lo pidió.
  const placeId = placeKey(place)
  useEffect(() => {
    setState((s) => (s === 'sending' ? s : wasRequested(place) ? 'done' : 'idle'))
  }, [placeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!user) {
      setState('error')
      return
    }
    haptic(15)
    setState('sending')
    try {
      await requestCity(user.uid, point, place, source)
      try {
        localStorage.setItem(doneKey(place), '1')
      } catch {
        /* sin almacenamiento: la próxima vez se podrá volver a pedir (solo actualiza la fecha) */
      }
      trackEvent('city_requested', { place: place.place, region: place.region, country: place.country })
      setState('done')
    } catch (e) {
      console.error('No se pudo enviar el pedido', e)
      setState('error')
    }
  }

  return (
    <div className="rounded-[32px] bg-white/95 p-4 shadow-float backdrop-blur">
      <div className="flex items-start gap-3 px-1 pb-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-butter-soft text-butter-deep">
          <MapPinOff className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold leading-tight text-ink">Tu ciudad todavía no está activa</p>
          <p className="text-sm text-ink-muted">
            {named ? (
              <>
                Estás en <b className="text-ink-soft">{place.place}</b>, donde Huecazo aún no funciona.
              </>
            ) : (
              'Huecazo aún no funciona en tu zona.'
            )}{' '}
            Por ahora estamos en{' '}
            <button onClick={onShowCities} className="font-semibold text-ink-soft underline decoration-dotted underline-offset-2">
              {activeCities}
            </button>
            .
          </p>
        </div>
      </div>

      {state === 'done' ? (
        <motion.p
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-3 rounded-[24px] bg-mint-soft px-4 py-3 text-sm text-mint-deep"
        >
          <Check className="h-5 w-5 shrink-0" />
          <span>
            <b>¡Pedido enviado!</b> Mientras más vecinos de {named ? place.place : 'tu zona'} lo pidan, antes llegamos.
          </span>
        </motion.p>
      ) : (
        <>
          <button onClick={send} disabled={state === 'sending'} className="btn-primary w-full text-lg">
            {state === 'sending' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <span aria-hidden>🙋</span>}
            {named ? `Pedir que activen ${place.place}` : 'Pedir que activen mi ciudad'}
          </button>
          {state === 'error' && (
            <p className="mt-3 rounded-2xl bg-coral-soft px-4 py-2 text-sm text-coral-deep">
              No se pudo enviar el pedido. Revisa tu conexión e inténtalo de nuevo.
            </p>
          )}
        </>
      )}

      <nav className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-ink-soft">
        <Link to="/mis-reportes" className="flex items-center gap-1.5 rounded-full px-3 py-2 transition active:scale-95">
          <ListChecks className="h-4 w-4" /> Mis reportes
        </Link>
        <span className="text-ink-faint" aria-hidden>
          ·
        </span>
        <Link to="/acerca" className="flex items-center gap-1.5 rounded-full px-3 py-2 transition active:scale-95">
          <Info className="h-4 w-4" /> ¿Qué es Huecazo?
        </Link>
      </nav>
    </div>
  )
}

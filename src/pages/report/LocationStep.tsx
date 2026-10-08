import { useEffect, useMemo, useRef, useState } from 'react'
import { AdvancedMarker, Circle, ColorScheme, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import type { MapCameraChangedEvent } from '@vis.gl/react-google-maps'
import { motion } from 'motion/react'
import { distanceBetween } from 'geofire-common'
import { CircleCheck, LoaderCircle, LocateFixed, MapPin, RotateCw, TriangleAlert } from 'lucide-react'
import { haptic } from '../../lib/fx'
import { MAP_ID } from '../../components/MapsProvider'
import { formatCoords } from '../../lib/geo'
import { TACNA_CENTER } from '../../lib/types'
import type { LatLng } from '../../lib/types'
import type { GeoError, GeoWatch } from '../../hooks/useGeoWatch'

// Mismos límites que firestore.rules (región Tacna).
const inTacna = ({ lat, lng }: LatLng) => lat > -18.6 && lat < -16.9 && lng > -71.1 && lng < -69.4

const ACCURATE_M = 30

const GEO_ERRORS: Record<GeoError, string> = {
  insecure: 'Tu navegador bloquea la ubicación porque la página no usa https. Abre la app desde su enlace https.',
  unsupported: 'Tu navegador no permite obtener la ubicación.',
  denied: 'No diste permiso de ubicación. Actívalo en el candado 🔒 junto a la dirección de la página y reintenta.',
  unavailable: 'No logramos señal de GPS. Revisa que la ubicación del celular esté activada.',
  timeout: 'El GPS está tardando. Sal a un lugar abierto o reintenta.',
}

/** Zoom según qué tan precisa es la lectura: si es imprecisa, mostramos más contexto. */
const zoomFor = (accuracy: number) => (accuracy > 500 ? 15 : accuracy > 120 ? 16 : accuracy > 40 ? 17 : 18)

export function LocationStep({
  geo,
  location,
  address,
  onLocation,
  onAddress,
  onConfirm,
  checking,
}: {
  geo: GeoWatch
  location: LatLng | null
  address: string | null
  onLocation: (l: LatLng) => void
  onAddress: (a: string | null) => void
  onConfirm: () => void
  checking: boolean
}) {
  const [moving, setMoving] = useState(false)
  const [target, setTarget] = useState<{ pos: LatLng; zoom: number; key: number } | null>(null)
  const startRef = useRef(location)
  // Seguimos al GPS mientras afina, hasta que la persona mueva el mapa a mano.
  const followRef = useRef(!startRef.current)
  const [userMoved, setUserMoved] = useState(!!startRef.current)

  const { fix } = geo
  // Google Maps espera literales {lat, lng} sin campos extra.
  const gps = useMemo(() => (fix ? { lat: fix.lat, lng: fix.lng } : null), [fix])
  useEffect(() => {
    if (!fix || !followRef.current) return
    const pos = { lat: fix.lat, lng: fix.lng }
    setTarget({ pos, zoom: zoomFor(fix.accuracy), key: fix.at })
    onLocation(pos)
  }, [fix]) // eslint-disable-line react-hooks/exhaustive-deps

  // Si la lectura que tenemos es vieja (la persona tardó en tomar las fotos), pedimos una nueva.
  useEffect(() => {
    if (!geo.watching && fix && Date.now() - fix.at > 60000) geo.restart()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const recenter = () => {
    haptic(8)
    followRef.current = true
    setUserMoved(false)
    if (fix) {
      const pos = { lat: fix.lat, lng: fix.lng }
      setTarget({ pos, zoom: zoomFor(fix.accuracy), key: Date.now() })
      onLocation(pos)
    }
    geo.restart()
  }

  const outside = location ? !inTacna(location) : false
  const waitingFirstFix = !fix && !geo.error && !userMoved
  const needsManualPin = !fix && !!geo.error && !userMoved
  // No dejamos confirmar una lectura muy imprecisa mientras el GPS sigue afinando.
  const refining = !!fix && geo.watching && fix.accuracy > 100 && !userMoved
  const pinDistance = fix && location ? Math.round(distanceBetween([fix.lat, fix.lng], [location.lat, location.lng]) * 1000) : 0

  return (
    <div className="relative flex-1">
      <Map
        className="absolute inset-0"
        mapId={MAP_ID}
        colorScheme={ColorScheme.LIGHT}
        defaultCenter={startRef.current ?? gps ?? TACNA_CENTER}
        defaultZoom={startRef.current ? 18 : fix ? zoomFor(fix.accuracy) : 14}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        onDragstart={() => {
          followRef.current = false
          setUserMoved(true)
          setMoving(true)
        }}
        onIdle={() => setMoving(false)}
        onCameraChanged={(ev: MapCameraChangedEvent) => onLocation(ev.detail.center)}
      >
        <FlyTo target={target} />
        <ReverseGeocoder location={location} moving={moving} onAddress={onAddress} />
        {fix && gps && (
          <>
            <Circle
              center={gps}
              radius={fix.accuracy}
              fillColor="#8FCBFF"
              fillOpacity={0.18}
              strokeColor="#6AB3F2"
              strokeOpacity={0.6}
              strokeWeight={1.5}
              clickable={false}
            />
            <AdvancedMarker position={gps} zIndex={1} anchorLeft="-50%" anchorTop="-50%">
              <span className="block h-4 w-4 rounded-full border-[3px] border-white bg-sky-shade shadow-soft" />
            </AdvancedMarker>
          </>
        )}
      </Map>

      {/* Pin fijo en el centro: se mueve el mapa, no el pin */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
        <motion.div
          animate={moving ? { y: -16, scale: 1.05 } : { y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        >
          <BigPin />
        </motion.div>
      </div>
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-2.5 w-6 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-ink/30 blur-[1.5px]"
        animate={moving ? { scale: 0.6, opacity: 0.4 } : { scale: 1, opacity: 1 }}
      />

      {/* Instrucción superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-1">
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mx-auto max-w-lg rounded-[24px] bg-white/95 px-4 py-3 shadow-soft backdrop-blur"
        >
          <p className="font-display text-xl font-semibold text-ink">¿Dónde está el hueco? 📍</p>
          <p className="text-sm text-ink-muted">
            El punto azul eres tú. Mueve el mapa hasta que el pin quede sobre el hueco.
          </p>
        </motion.div>
      </div>

      {/* Botón ubicarme */}
      <button
        onClick={recenter}
        className="icon-btn absolute right-4 z-10 bottom-[calc(16rem+env(safe-area-inset-bottom))] text-sky-deep"
        aria-label="Volver a mi ubicación"
      >
        {geo.watching && !fix ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
      </button>

      {/* Panel inferior */}
      <div className="absolute inset-x-0 bottom-0 z-10 pb-safe">
        <div className="mx-auto max-w-lg px-4 pb-4">
          <div className="rounded-[32px] bg-white/95 p-4 shadow-float backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-coral-soft text-coral-deep">
                <MapPin className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {waitingFirstFix ? 'Buscando dónde estás…' : (address ?? 'Punto seleccionado')}
                </p>
                <p className="tabular text-xs text-ink-muted">
                  {waitingFirstFix || !location ? '—' : formatCoords(location)}
                  {userMoved && pinDistance > 25 && ` · a ${pinDistance} m de ti`}
                </p>
              </div>
            </div>

            <GpsStatus geo={geo} onRetry={recenter} />

            {outside && (
              <p className="mt-3 flex gap-2 rounded-2xl bg-coral-soft px-3 py-2 text-xs text-coral-deep">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                Ese punto está fuera de Tacna. Por ahora solo recibimos reportes de la región.
              </p>
            )}

            <button
              className="btn-primary mt-4 w-full"
              onClick={() => {
                haptic(12)
                onConfirm()
              }}
              disabled={!location || outside || checking || moving || waitingFirstFix || needsManualPin || refining}
            >
              {checking ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" /> Revisando la zona…
                </>
              ) : waitingFirstFix || refining ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" /> Ubicándote…
                </>
              ) : needsManualPin ? (
                'Mueve el mapa hasta el hueco'
              ) : (
                'Sí, aquí está'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GpsStatus({ geo, onRetry }: { geo: GeoWatch; onRetry: () => void }) {
  const { fix, watching, error } = geo

  if (error && !fix) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-2xl bg-butter-soft px-3 py-2 text-xs text-butter-deep">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="flex-1">{GEO_ERRORS[error]}</span>
        {error !== 'insecure' && error !== 'unsupported' && (
          <button onClick={onRetry} className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 font-bold">
            <RotateCw className="h-3 w-3" /> Reintentar
          </button>
        )}
      </div>
    )
  }
  if (!fix) return null

  const acc = Math.round(fix.accuracy)
  if (watching && acc > ACCURATE_M) {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-2xl bg-sky-soft px-3 py-2 text-xs font-medium text-sky-deep">
        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
        Afinando tu ubicación… (±{acc} m)
      </p>
    )
  }
  if (acc <= ACCURATE_M) {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-2xl bg-mint-soft px-3 py-2 text-xs font-medium text-mint-deep">
        <CircleCheck className="h-4 w-4 shrink-0" />
        Ubicación precisa (±{acc} m)
      </p>
    )
  }
  return (
    <p className="mt-3 flex items-start gap-2 rounded-2xl bg-butter-soft px-3 py-2 text-xs text-butter-deep">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      Tu ubicación es aproximada (±{acc} m). Revisa que el pin esté justo sobre el hueco.
    </p>
  )
}

function FlyTo({ target }: { target: { pos: LatLng; zoom: number; key: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !target) return
    map.panTo(target.pos)
    map.setZoom(target.zoom)
  }, [map, target])
  return null
}

function ReverseGeocoder({
  location,
  moving,
  onAddress,
}: {
  location: LatLng | null
  moving: boolean
  onAddress: (a: string | null) => void
}) {
  const geocodingLib = useMapsLibrary('geocoding')
  const geocoder = useRef<google.maps.Geocoder | null>(null)
  const latest = useRef(location)
  latest.current = location

  useEffect(() => {
    if (geocodingLib && !geocoder.current) geocoder.current = new geocodingLib.Geocoder()
  }, [geocodingLib])

  useEffect(() => {
    if (moving || !geocoder.current || !latest.current) return
    const loc = latest.current
    const t = setTimeout(() => {
      // geocode() puede lanzar o no devolver promesa si la API key no es válida.
      new Promise<google.maps.GeocoderResponse>((resolve, reject) => {
        try {
          Promise.resolve(geocoder.current?.geocode({ location: loc })).then((r) => (r ? resolve(r) : reject()), reject)
        } catch (err) {
          reject(err)
        }
      })
        .then(({ results }) => {
          const best = results.find((r) => r.types.includes('street_address') || r.types.includes('route')) ?? results[0]
          onAddress(best ? best.formatted_address.replace(/, Perú$/, '').replace(/\s\d{5},?/, '') : null)
        })
        // Si la Geocoding API no está habilitada, seguimos sin dirección.
        .catch(() => onAddress(null))
    }, 350)
    return () => clearTimeout(t)
  }, [moving, geocodingLib, location?.lat, location?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function BigPin() {
  return (
    <svg width="56" height="68" viewBox="0 0 40 48" aria-hidden className="drop-shadow-[0_10px_10px_rgba(120,84,60,.35)]">
      <path
        d="M20 46c-1 0-1.9-.5-2.5-1.3C12 37.2 3 28.2 3 19 3 9.6 10.6 2.5 20 2.5S37 9.6 37 19c0 9.2-9 18.2-14.5 25.7-.6.8-1.5 1.3-2.5 1.3z"
        fill="#FF8E7A"
        stroke="#fff"
        strokeWidth="2.5"
      />
      <circle cx="20" cy="18.5" r="9" fill="#fff" />
      <ellipse cx="20" cy="20" rx="5.5" ry="3" fill="#2F2B3A" />
    </svg>
  )
}

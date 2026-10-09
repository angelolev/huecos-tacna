import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Building2, Camera, Check, ChevronDown, Info, ListChecks, LoaderCircle, MapPin, Navigation, Trophy, UserRound } from 'lucide-react'
import { Circle, useMap } from '@vis.gl/react-google-maps'
import { useAuth } from '../context/AuthContext'
import { useReports } from '../hooks/useReports'
import { useCountUp } from '../hooks/useCountUp'
import { useGeoWatch } from '../hooks/useGeoWatch'
import { useApproxLocation } from '../hooks/useApproxLocation'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { PointsToast } from '../components/PointsToast'
import { ChampionCelebration } from '../components/ChampionCelebration'
import { pointEvents } from '../lib/points'
import { ensureProfile } from '../lib/profiles'
import { Logo } from '../components/Logo'
import { ReportsMap } from '../components/ReportsMap'
import { ReportSheet } from '../components/ReportSheet'
import { AccountSheet } from '../components/AccountSheet'
import { BottomSheet } from '../components/BottomSheet'
import { CityRequestCard } from '../components/CityRequestCard'
import { NEAR_RADIUS_M, boundsAround, boundsContain, metersBetween } from '../lib/geo'
import { listCityNames, useCities } from '../context/CitiesContext'
import { haptic } from '../lib/fx'
import { PERU_CENTER } from '../lib/types'
import type { City, LatLng, Report, ReportStatus } from '../lib/types'

const spring = { type: 'spring', stiffness: 260, damping: 22 } as const

/** Vista del mapa: cerca de mí (500 m), toda la ciudad, o libre (la persona movió el mapa). */
type View = 'near' | 'city' | null

/** Espacio que ocupan la barra superior y la tarjeta inferior sobre el mapa. */
const MAP_PADDING = { top: 130, bottom: 330, left: 24, right: 24 }

/**
 * Reduce el margen en pantallas bajas (laptop, celular en horizontal): si el margen
 * supera el alto del mapa, Google Maps no puede encuadrar y se aleja hasta el mundo entero.
 */
function paddingFor(map: google.maps.Map): google.maps.Padding {
  const h = map.getDiv().clientHeight
  const vertical = MAP_PADDING.top + MAP_PADDING.bottom
  const max = h * 0.6
  if (!h || vertical <= max) return MAP_PADDING
  const k = max / vertical
  return { ...MAP_PADDING, top: Math.round(MAP_PADDING.top * k), bottom: Math.round(MAP_PADDING.bottom * k) }
}

/** Centro de la última ciudad activa donde estuvo la persona (no su posición exacta). */
const LAST_CENTER_KEY = 'huecazo:last-city-center'

/**
 * Dónde arranca el mapa: la ciudad donde estuvo la última vez o, la primera vez, el Perú entero.
 * Nunca una ciudad "por defecto": quien abre la app en otra ciudad no debe ver Tacna.
 */
function initialMapView(): { center: LatLng; zoom: number } {
  try {
    const c = JSON.parse(localStorage.getItem(LAST_CENTER_KEY) ?? 'null') as LatLng | null
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) return { center: { lat: c.lat, lng: c.lng }, zoom: 13 }
  } catch {
    /* sin almacenamiento */
  }
  return { center: PERU_CENTER, zoom: 5 }
}

export default function HomePage() {
  const { user } = useAuth()
  const { reports, loading, error } = useReports()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [show, setShow] = useState<Record<'activos' | 'reparados', boolean>>({ activos: true, reparados: false })
  const [accountOpen, setAccountOpen] = useState(false)
  useDocumentMeta()

  const selectedId = params.get('r')
  // Si llegamos con un reporte en la URL, mostramos ese reporte y no la zona del usuario.
  const [view, setView] = useState<View>(selectedId ? null : 'near')
  const geo = useGeoWatch(true)
  const me = useMemo(() => (geo.fix ? { lat: geo.fix.lat, lng: geo.fix.lng } : null), [geo.fix])
  const geoFailed = !!geo.error && !me
  // El GPS aún no responde (ni con error).
  const gpsPending = !me && !geo.error
  // Ubicación aproximada por la IP: llega antes que el GPS y sirve aunque no den permiso.
  const approx = useApproxLocation()
  const approxPoint = useMemo(() => (approx ? { lat: approx.lat, lng: approx.lng } : null), [approx])
  // Dónde está la persona: el GPS o, mientras tanto (o sin permiso), su ciudad según la IP.
  const where = me ?? approxPoint
  const [mapStart] = useState(initialMapView)

  // Ciudad de contexto: todo el inicio (marcadores, contadores, "Toda la ciudad") muestra SOLO sus reportes.
  // - La ciudad donde está la persona; o la que eligió a mano en el selector.
  // - Fuera de toda ciudad activa: ninguna (no se muestran reportes de otras ciudades) y le ofrecemos
  //   pedir que activen la suya.
  // - Sin ninguna ubicación: ninguna. Nunca mandamos a nadie a una ciudad "por defecto".
  const { enabledCities, enabledCityFor, cities } = useCities()
  const [pickedCityId, setPickedCityId] = useState<string | null>(null)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const myCity = where ? enabledCityFor(where) : null
  const pickedCity = cities.find((c) => c.id === pickedCityId) ?? null
  const contextCity: City | null = pickedCity ?? myCity
  // La IP de los celulares a veces apunta a otra ciudad (p. ej. Lima): solo decimos "fuera de zona"
  // con la IP si el GPS no está disponible.
  const outsideCities = !!where && !myCity && !pickedCity && !gpsPending

  // Recordamos la ciudad (no la posición) para abrir el mapa ahí la próxima vez.
  useEffect(() => {
    if (!me || !myCity) return
    try {
      localStorage.setItem(LAST_CENTER_KEY, JSON.stringify(myCity.center))
    } catch {
      /* sin almacenamiento */
    }
  }, [!!me, myCity?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sin GPS no hay "cerca de mí": mostramos toda la ciudad (si sabemos cuál es).
  useEffect(() => {
    if (view === 'near' && geoFailed && contextCity) setView('city')
  }, [view, geoFailed, contextCity])
  const selected = reports.find((r) => r.id === selectedId) ?? null

  // Al abrir un reporte (p. ej. un enlace compartido), el mapa queda en la ciudad de ese reporte,
  // sin importar si el GPS respondió antes o después.
  useEffect(() => {
    if (selected?.cityId && !pickedCityId) setPickedCityId(selected.cityId)
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const cityReports = useMemo(
    () => (contextCity ? reports.filter((r) => inCity(r, contextCity)) : []),
    [reports, contextCity],
  )
  // Los reportes rechazados (falsos) nunca se muestran en el mapa.
  const isVisible = (s: ReportStatus) => (s === 'reparado' ? show.reparados : s !== 'rechazado' && show.activos)
  const visible = useMemo(
    () => {
      const list = cityReports.filter((r) => isVisible(r.status))
      // El reporte abierto (p. ej. desde un enlace) siempre se ve.
      if (selected && selected.status !== 'rechazado' && !list.includes(selected)) list.push(selected)
      return list
    },
    [cityReports, show, selected], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const isActive = (r: Report) => r.status === 'pendiente' || r.status === 'verificado'
  const active = cityReports.filter(isActive).length
  const fixed = cityReports.filter((r) => r.status === 'reparado').length
  // Para el aviso "¡Ganaste puntos!" bastan los reportes (verificado, reparado, confirmaciones, rechazado).
  const events = useMemo(() => pointEvents(reports, []), [reports])

  // Quien ya tenía puntos antes de que el alias fuera automático lo recibe al abrir la app
  // (una sola vez por dispositivo).
  useEffect(() => {
    if (!user || !events.some((e) => e.uid === user.uid && e.points > 0)) return
    const key = `huecazo:alias:${user.uid}`
    try {
      if (localStorage.getItem(key)) return
    } catch {
      /* sin almacenamiento: ensureProfile solo lee si ya existe */
    }
    ensureProfile(user.uid)
      .then(() => {
        try {
          localStorage.setItem(key, '1')
        } catch {
          /* volveremos a revisar la próxima vez */
        }
      })
      .catch((e) => console.error('No se pudo asignar el alias', e))
  }, [user, events])
  const cityActive = active
  const nearCount = useMemo(
    () => (me ? cityReports.filter((r) => isActive(r) && metersBetween(me, r) <= NEAR_RADIUS_M).length : 0),
    [cityReports, me],
  )

  const chooseView = (v: Exclude<View, null>) => {
    haptic(8)
    // Fuera de toda ciudad activa, "Toda la ciudad" no tiene a dónde ir: ofrecemos elegir una.
    if (v === 'city' && !contextCity) {
      setCityPickerOpen(true)
      return
    }
    if (v === 'near') {
      if (!me) geo.restart()
      // Volver a "cerca de mí" vuelve también a la ciudad donde está la persona.
      setPickedCityId(null)
    }
    setView(v)
  }

  const pickCity = (id: string | null) => {
    haptic(8)
    setPickedCityId(id)
    setCityPickerOpen(false)
    setView(id ? 'city' : 'near')
  }

  // Abrir un reporte desde el mapa agrega una entrada al historial: "atrás" cierra el detalle en vez
  // de salir de la app. Cambiar de reporte con uno ya abierto la reemplaza (un solo "atrás" lo cierra).
  const openedHere = !!(location.state as { detalle?: boolean } | null)?.detalle
  const select = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) {
      next.set('r', id)
      setParams(next, selectedId ? { replace: true, state: location.state } : { state: { detalle: true } })
    } else if (openedHere) {
      navigate(-1)
    } else {
      // Llegó con el reporte en la URL (enlace compartido, "Mis reportes"): solo lo quitamos.
      next.delete('r')
      setParams(next, { replace: true })
    }
  }

  const toggle = (key: 'activos' | 'reparados') => {
    haptic(8)
    setShow((s) => ({ ...s, [key]: !s[key] }))
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-cream-100">
      <ReportsMap
        className="absolute inset-0"
        defaultCenter={mapStart.center}
        defaultZoom={mapStart.zoom}
        reports={visible}
        userLocation={me}
        selectedId={selectedId}
        onSelect={(r) => {
          haptic(8)
          select(r.id)
        }}
        onUserMove={() => setView(null)}
      >
        <ViewController view={view} me={me} approx={approxPoint} geoFailed={geoFailed} city={contextCity} reports={visible} />
        {me && view === 'near' && (
          <Circle
            center={me}
            radius={NEAR_RADIUS_M}
            fillColor="#8FCBFF"
            fillOpacity={0.08}
            strokeColor="#6AB3F2"
            strokeOpacity={0.55}
            strokeWeight={2}
            clickable={false}
          />
        )}
      </ReportsMap>

      {/* Barra superior flotante */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-safe">
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={spring}
          className="pointer-events-auto mx-auto mt-3 flex max-w-lg items-center justify-between px-4"
        >
          <div className="rounded-full bg-white/95 py-2 pl-3 pr-4 shadow-soft backdrop-blur">
            <Logo />
          </div>
          <div className="flex gap-2">
            <Link to="/ranking" className="icon-btn" aria-label="Ranking de vecinos">
              <Trophy className="h-5 w-5 text-butter-deep" />
            </Link>
            <button onClick={() => setAccountOpen(true)} className="icon-btn overflow-hidden" aria-label="Tu cuenta">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserRound className="h-5 w-5 text-ink-soft" />
              )}
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...spring, delay: 0.08 }}
          className="no-scrollbar pointer-events-auto mx-auto mt-3 flex max-w-lg gap-2 overflow-x-auto px-4 pb-1"
        >
          <CityPill city={contextCity} outside={outsideCities} onClick={() => setCityPickerOpen(true)} />
          {loading ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm text-ink-muted shadow-soft">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Cargando reportes…
            </span>
          ) : (
            <>
              <FilterChip
                on={show.activos}
                onClick={() => toggle('activos')}
                count={active}
                label="por reparar"
                dot="#FF8E7A"
                soft="#FFE3DC"
              />
              <FilterChip
                on={show.reparados}
                onClick={() => toggle('reparados')}
                count={fixed}
                label={fixed === 1 ? 'reparado' : 'reparados'}
                dot="#7FD8A9"
                soft="#DDF5E8"
              />
            </>
          )}
        </motion.div>
        {error && (
          <p className="pointer-events-auto mx-4 mt-2 rounded-2xl bg-coral-soft px-4 py-2 text-sm text-coral-deep">{error}</p>
        )}
      </header>

      {/* Tarjeta inferior con la acción principal */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 pb-safe">
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...spring, delay: 0.15 }}
          className="pointer-events-auto mx-auto mb-4 max-w-lg px-4"
        >
          <ViewSwitch view={view} onChange={chooseView} />
          {outsideCities && where ? (
            <CityRequestCard
              point={where}
              source={me ? 'gps' : 'ip'}
              approx={approx}
              activeCities={listCityNames(enabledCities)}
              onShowCities={() => setCityPickerOpen(true)}
            />
          ) : (
            <>
              <ViewHint
                view={view}
                locating={gpsPending}
                geoFailed={geoFailed}
                nearCount={nearCount}
                loading={loading}
                city={contextCity}
                cityActive={cityActive}
              />
              <div className="rounded-[32px] bg-white/95 p-4 shadow-float backdrop-blur">
                <div className="flex items-center gap-3 px-1 pb-4">
                  <span className="animate-floaty text-3xl" aria-hidden>
                    🚧
                  </span>
                  <div>
                    <p className="font-display text-xl font-semibold leading-tight text-ink">¿Viste un hueco?</p>
                    <p className="text-sm text-ink-muted">Repórtalo en 30 segundos, sin registrarte.</p>
                  </div>
                </div>
                <Link to="/reportar" onClick={() => haptic(15)} className="btn-primary w-full text-xl">
                  <Camera className="h-6 w-6" /> Reportar un hueco
                </Link>
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
            </>
          )}
        </motion.div>
      </footer>

      <ReportSheet report={selected?.status === 'rechazado' ? null : selected} onClose={() => select(null)} />
      <CityPicker
        open={cityPickerOpen}
        onClose={() => setCityPickerOpen(false)}
        cities={enabledCities}
        current={contextCity?.id ?? null}
        myCityId={myCity?.id ?? null}
        hasLocation={!!where}
        reports={reports}
        onPick={pickCity}
      />
      <PointsToast uid={user?.uid} events={events} ready={!loading} />
      <ChampionCelebration uid={user?.uid} reports={reports} ready={!loading} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  )
}

function CityPill({ city, outside, onClick }: { city: City | null; outside: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/95 py-2 pl-3 pr-3.5 text-sm font-semibold text-ink shadow-soft"
      aria-label="Elegir ciudad"
    >
      <MapPin className={`h-4 w-4 ${outside ? 'text-ink-muted' : 'text-coral-deep'}`} />
      {city ? city.name : outside ? 'Fuera de zona' : 'Ciudad'}
      <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
    </motion.button>
  )
}

function CityPicker({
  open,
  onClose,
  cities,
  current,
  myCityId,
  hasLocation,
  reports,
  onPick,
}: {
  open: boolean
  onClose: () => void
  cities: City[]
  current: string | null
  myCityId: string | null
  hasLocation: boolean
  reports: Report[]
  onPick: (id: string | null) => void
}) {
  const activeIn = (c: City) => reports.filter((r) => (r.status === 'pendiente' || r.status === 'verificado') && inCity(r, c)).length
  return (
    <BottomSheet open={open} onClose={onClose} label="Elegir ciudad">
      <div className="space-y-3 px-5 pb-6 pt-1">
        <div>
          <p className="font-display text-2xl font-semibold">¿Qué ciudad quieres ver?</p>
          <p className="text-sm text-ink-muted">El mapa solo muestra los huecos de la ciudad elegida.</p>
        </div>
        {hasLocation && (
          <button onClick={() => onPick(null)} className="card flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:scale-[.98]">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-soft text-sky-deep">
              <Navigation className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Donde estoy</span>
              <span className="text-xs text-ink-muted">
                {myCityId ? cities.find((c) => c.id === myCityId)?.name : 'Huecazo aún no llega a tu zona'}
              </span>
            </span>
          </button>
        )}
        {cities.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            className={`card flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:scale-[.98] ${current === c.id ? 'ring-2 ring-coral' : ''}`}
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-coral-soft text-coral-deep">
              <Building2 className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{c.name}</span>
              <span className="text-xs text-ink-muted">
                {activeIn(c)} {activeIn(c) === 1 ? 'hueco por reparar' : 'huecos por reparar'}
              </span>
            </span>
            {current === c.id && <Check className="h-5 w-5 text-coral-deep" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

function FilterChip({
  on,
  onClick,
  count,
  label,
  dot,
  soft,
}: {
  on: boolean
  onClick: () => void
  count: number
  label: string
  dot: string
  soft: string
}) {
  const n = useCountUp(count)
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-pressed={on}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-2 pl-2 pr-4 text-sm shadow-soft transition-colors"
      style={{ background: on ? soft : 'rgba(255,255,255,.95)' }}
    >
      <span
        className="grid h-7 min-w-7 place-items-center rounded-full px-1.5 font-display text-sm font-semibold tabular transition-colors"
        style={{ background: on ? dot : '#F0E5DA', color: '#2F2B3A' }}
      >
        {n}
      </span>
      <span className={`font-semibold ${on ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
    </motion.button>
  )
}

/**
 * Ajusta la cámara según la vista elegida. En "cerca de mí" encuadra 500 m alrededor del usuario
 * y vuelve a encuadrar si el GPS afina la posición (más de 60 m de diferencia).
 */
/** El reporte pertenece a la ciudad (por su `cityId` o, en reportes antiguos, por su ubicación). */
function inCity(r: Report, city: City) {
  return r.cityId ? r.cityId === city.id : boundsContain(city.bounds, r)
}

function ViewController({
  view,
  me,
  approx,
  geoFailed,
  city,
  reports,
}: {
  view: View
  me: LatLng | null
  /** Ubicación aproximada por IP. */
  approx: LatLng | null
  geoFailed: boolean
  city: City | null
  reports: Report[]
}) {
  const map = useMap()
  const lastNear = useRef<LatLng | null>(null)
  const approxShown = useRef(false)

  // Sin GPS todavía: mostramos la ciudad aproximada (IP) si el GPS falla o tarda en responder.
  // No de inmediato: la IP de los celulares a veces apunta a otra ciudad y el GPS llega en segundos.
  useEffect(() => {
    if (!map || me || !approx || view !== 'near' || approxShown.current) return
    const show = () => {
      approxShown.current = true
      map.setCenter(approx)
      map.setZoom(12)
    }
    if (geoFailed) {
      show()
      return
    }
    const timer = setTimeout(show, 2500)
    return () => clearTimeout(timer)
  }, [map, me, approx, view, geoFailed])

  useEffect(() => {
    if (!map) return
    if (view !== 'near') {
      lastNear.current = null
      return
    }
    if (!me) return
    if (lastNear.current && metersBetween(lastNear.current, me) < 60) return
    lastNear.current = me
    map.fitBounds(boundsAround(me, NEAR_RADIUS_M), paddingFor(map))
  }, [map, view, me])

  // "Toda la ciudad": la zona urbana más los reportes de esa ciudad que queden fuera de ella.
  useEffect(() => {
    if (!map || view !== 'city' || !city) return
    const bounds = new google.maps.LatLngBounds(city.viewBounds)
    reports.filter((r) => inCity(r, city)).forEach((r) => bounds.extend({ lat: r.lat, lng: r.lng }))
    map.fitBounds(bounds, paddingFor(map))
  }, [map, view, city?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

const VIEWS = [
  { id: 'near' as const, label: 'Cerca de mí', Icon: Navigation },
  { id: 'city' as const, label: 'Toda la ciudad', Icon: Building2 },
]

function ViewSwitch({ view, onChange }: { view: View; onChange: (v: Exclude<View, null>) => void }) {
  return (
    <div className="mx-auto mb-2 flex w-fit gap-1 rounded-full bg-white/95 p-1 shadow-soft backdrop-blur" role="tablist" aria-label="Vista del mapa">
      {VIEWS.map(({ id, label, Icon }) => {
        const on = view === id
        return (
          <button
            key={id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(id)}
            className={`relative flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors active:scale-95 ${
              on ? 'text-ink' : 'text-ink-muted'
            }`}
          >
            {on && (
              <motion.span
                layoutId="view-pill"
                className="absolute inset-0 rounded-full bg-sky-soft ring-2 ring-sky"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            <Icon className={`relative h-4 w-4 ${on ? 'text-sky-deep' : ''}`} />
            <span className="relative">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

function ViewHint({
  view,
  locating,
  geoFailed,
  nearCount,
  loading,
  city,
  cityActive,
}: {
  view: View
  locating: boolean
  geoFailed: boolean
  nearCount: number
  loading: boolean
  city: City | null
  cityActive: number
}) {
  let text: string | null = null
  if (geoFailed) text = 'Activa tu ubicación para ver los huecos cerca de ti.'
  else if (view === 'city' && city && !loading)
    text = `${city.name}: ${cityActive} ${cityActive === 1 ? 'hueco por reparar' : 'huecos por reparar'}`
  else if (view === 'near' && locating) text = 'Buscando tu ubicación…'
  else if (view === 'near' && !loading)
    text =
      nearCount === 0
        ? 'No hay huecos reportados a menos de 500 m 🎉'
        : `${nearCount} ${nearCount === 1 ? 'hueco por reparar' : 'huecos por reparar'} a menos de 500 m`

  return (
    <AnimatePresence mode="wait" initial={false}>
      {text && (
        <motion.p
          key={text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="mx-auto mb-2 w-fit rounded-full bg-white/90 px-3 py-1 text-center text-xs font-semibold text-ink-soft shadow-soft backdrop-blur"
        >
          {text}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

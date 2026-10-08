import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Building2, Camera, Info, ListChecks, LoaderCircle, Navigation, UserRound } from 'lucide-react'
import { Circle, useMap } from '@vis.gl/react-google-maps'
import { useAuth } from '../context/AuthContext'
import { useReports } from '../hooks/useReports'
import { useCountUp } from '../hooks/useCountUp'
import { useGeoWatch } from '../hooks/useGeoWatch'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { Logo } from '../components/Logo'
import { ReportsMap } from '../components/ReportsMap'
import { ReportSheet } from '../components/ReportSheet'
import { AccountSheet } from '../components/AccountSheet'
import { NEAR_RADIUS_M, boundsAround, boundsContain, metersBetween } from '../lib/geo'
import { listCityNames, useCities } from '../context/CitiesContext'
import { haptic } from '../lib/fx'
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

export default function HomePage() {
  const { user } = useAuth()
  const { reports, loading, error } = useReports()
  const [params, setParams] = useSearchParams()
  const [show, setShow] = useState<Record<'activos' | 'reparados', boolean>>({ activos: true, reparados: false })
  const [accountOpen, setAccountOpen] = useState(false)
  useDocumentMeta()

  const selectedId = params.get('r')
  // Si llegamos con un reporte en la URL, mostramos ese reporte y no la zona del usuario.
  const [view, setView] = useState<View>(selectedId ? null : 'near')
  const geo = useGeoWatch(true)
  const me = useMemo(() => (geo.fix ? { lat: geo.fix.lat, lng: geo.fix.lng } : null), [geo.fix])
  const geoFailed = !!geo.error && !me

  // "Toda la ciudad" = la ciudad donde está la persona; si está fuera de las ciudades activas, la ciudad por defecto.
  const { enabledCities, enabledCityFor, defaultCity } = useCities()
  const myCity = me ? enabledCityFor(me) : null
  const viewCity = myCity ?? defaultCity
  const outsideCities = !!me && !myCity

  // Sin ubicación no hay "cerca de mí": mostramos toda la ciudad.
  useEffect(() => {
    if (view === 'near' && geoFailed) setView('city')
  }, [view, geoFailed])
  const isVisible = (s: ReportStatus) => (s === 'reparado' ? show.reparados : show.activos)
  const visible = useMemo(
    () => reports.filter((r) => isVisible(r.status) || r.id === selectedId),
    [reports, show, selectedId], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const selected = reports.find((r) => r.id === selectedId) ?? null
  const active = reports.filter((r) => r.status !== 'reparado').length
  const fixed = reports.length - active
  const cityActive = useMemo(
    () => reports.filter((r) => r.status !== 'reparado' && inCity(r, viewCity)).length,
    [reports, viewCity],
  )
  const nearCount = useMemo(
    () => (me ? reports.filter((r) => r.status !== 'reparado' && metersBetween(me, r) <= NEAR_RADIUS_M).length : 0),
    [reports, me],
  )

  const chooseView = (v: Exclude<View, null>) => {
    haptic(8)
    if (v === 'near' && !me) geo.restart()
    setView(v)
  }

  const select = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('r', id)
    else next.delete('r')
    setParams(next, { replace: true })
  }

  const toggle = (key: 'activos' | 'reparados') => {
    haptic(8)
    setShow((s) => ({ ...s, [key]: !s[key] }))
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-cream-100">
      <ReportsMap
        className="absolute inset-0"
        reports={visible}
        userLocation={me}
        selectedId={selectedId}
        onSelect={(r) => {
          haptic(8)
          select(r.id)
        }}
        onUserMove={() => setView(null)}
      >
        <ViewController view={view} me={me} city={viewCity} reports={visible} />
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
          <button onClick={() => setAccountOpen(true)} className="icon-btn overflow-hidden" aria-label="Tu cuenta">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserRound className="h-5 w-5 text-ink-soft" />
            )}
          </button>
        </motion.div>

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...spring, delay: 0.08 }}
          className="pointer-events-auto mx-auto mt-3 flex max-w-lg gap-2 px-4"
        >
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
          <ViewHint
            view={view}
            locating={!me && !geo.error}
            geoFailed={geoFailed}
            nearCount={nearCount}
            loading={loading}
            city={viewCity}
            cityActive={cityActive}
            outsideCities={outsideCities ? listCityNames(enabledCities) : null}
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
        </motion.div>
      </footer>

      <ReportSheet report={selected} onClose={() => select(null)} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
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
      className="inline-flex items-center gap-2 rounded-full py-2 pl-2 pr-4 text-sm shadow-soft transition-colors"
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

function ViewController({ view, me, city, reports }: { view: View; me: LatLng | null; city: City; reports: Report[] }) {
  const map = useMap()
  const lastNear = useRef<LatLng | null>(null)

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
    if (!map || view !== 'city') return
    const bounds = new google.maps.LatLngBounds(city.viewBounds)
    reports.filter((r) => inCity(r, city)).forEach((r) => bounds.extend({ lat: r.lat, lng: r.lng }))
    map.fitBounds(bounds, paddingFor(map))
  }, [map, view, city.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
  outsideCities,
}: {
  view: View
  locating: boolean
  geoFailed: boolean
  nearCount: number
  loading: boolean
  city: City
  cityActive: number
  /** Nombres de las ciudades activas, si la persona está fuera de todas. */
  outsideCities: string | null
}) {
  let text: string | null = null
  if (outsideCities) text = `Huecazo aún no llega a tu zona. Por ahora estamos en ${outsideCities}.`
  else if (geoFailed) text = 'Activa tu ubicación para ver los huecos cerca de ti.'
  else if (view === 'city' && !loading)
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

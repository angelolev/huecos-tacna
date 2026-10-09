import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ColorScheme, Map, Rectangle, useMapsLibrary } from '@vis.gl/react-google-maps'
import { ArrowLeft, Building2, LoaderCircle, MapPinned, Pencil, Plus, Search, X } from 'lucide-react'
import { MAP_ID } from '../../components/MapsProvider'
import { useCities } from '../../context/CitiesContext'
import { saveCity, setCityEnabled, slugify } from '../../lib/cities'
import { useBackClose } from '../../hooks/useBack'
import { boundsContain } from '../../lib/geo'
import { PERU_BOUNDS } from '../../lib/types'
import type { Bounds, City, Report } from '../../lib/types'

type Mode = { kind: 'list' } | { kind: 'edit'; city: City | null }

/** Panel para agregar ciudades, ajustar su zona y activarlas o pausarlas. */
export function CitiesManager({ open, onClose, reports }: { open: boolean; onClose: () => void; reports: Report[] }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  useBackClose(open, onClose)

  useEffect(() => {
    if (!open) setMode({ kind: 'list' })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 backdrop-blur-[3px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal
          aria-label="Ciudades"
        >
          <motion.div
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[32px] bg-cream-50 shadow-float sm:rounded-[32px]"
            initial={{ y: 40, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {mode.kind === 'list' ? (
              <CityList reports={reports} onClose={onClose} onEdit={(city) => setMode({ kind: 'edit', city })} />
            ) : (
              <CityEditor city={mode.city} onBack={() => setMode({ kind: 'list' })} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function CityList({ reports, onClose, onEdit }: { reports: Report[]; onClose: () => void; onEdit: (c: City | null) => void }) {
  const { cities, seeded } = useCities()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const countFor = (c: City) => reports.filter((r) => (r.cityId ? r.cityId === c.id : boundsContain(c.bounds, r))).length

  const toggle = async (c: City) => {
    setBusy(c.id)
    setErr(null)
    try {
      await setCityEnabled(c.id, !c.enabled)
    } catch (e) {
      console.error(e)
      setErr('No se pudo actualizar la ciudad. ¿Están publicadas las reglas de Firestore?')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Header title="Ciudades" subtitle="Dónde se puede reportar en Huecazo" onClose={onClose} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-6">
        {!seeded && (
          <p className="rounded-2xl bg-butter-soft px-4 py-3 text-sm text-butter-deep">
            Creando la ciudad inicial (Tacna)… Si esto no termina, revisa que las reglas de Firestore estén publicadas.
          </p>
        )}
        {cities.map((c) => (
          <div key={c.id} className="card flex items-center gap-3 p-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${c.enabled ? 'bg-mint-soft text-mint-deep' : 'bg-cream-200 text-ink-muted'}`}>
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-medium leading-tight">{c.name}</p>
              <p className="text-xs text-ink-muted">
                {c.department && `${c.department} · `}
                {countFor(c)} {countFor(c) === 1 ? 'reporte' : 'reportes'}
              </p>
            </div>
            <button onClick={() => onEdit(c)} className="icon-btn h-10 w-10 shadow-none ring-2 ring-line" aria-label={`Editar ${c.name}`}>
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => toggle(c)}
              disabled={busy === c.id || !seeded}
              role="switch"
              aria-checked={c.enabled}
              className={`flex w-[118px] items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-xs font-bold transition ${
                c.enabled ? 'bg-mint-soft text-mint-deep' : 'bg-cream-200 text-ink-muted'
              }`}
            >
              <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${c.enabled ? 'bg-mint' : 'bg-ink-faint'}`}>
                <motion.span
                  layout
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
                  style={{ left: c.enabled ? 18 : 2 }}
                />
              </span>
              {busy === c.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : c.enabled ? 'Activa' : 'Pausada'}
            </button>
          </div>
        ))}
        {err && <p className="text-sm text-coral-deep">{err}</p>}

        <button className="btn-soft w-full" onClick={() => onEdit(null)} disabled={!seeded}>
          <Plus className="h-4 w-4" /> Agregar ciudad
        </button>
        <p className="px-2 text-xs text-ink-muted">
          <b>Activa</b>: los vecinos pueden reportar dentro de su zona. <b>Pausada</b>: no se aceptan reportes nuevos, pero
          los existentes se siguen viendo.
        </p>
      </div>
    </>
  )
}

/** Amplía un rectángulo un `factor` por lado (la zona de reportes incluye los alrededores de la ciudad). */
function expand(b: Bounds, factor: number): Bounds {
  const dLat = (b.north - b.south) * factor
  const dLng = (b.east - b.west) * factor
  return { north: b.north + dLat, south: b.south - dLat, east: b.east + dLng, west: b.west - dLng }
}

const round = (b: Bounds): Bounds => ({
  north: +b.north.toFixed(5),
  south: +b.south.toFixed(5),
  east: +b.east.toFixed(5),
  west: +b.west.toFixed(5),
})

function CityEditor({ city, onBack }: { city: City | null; onBack: () => void }) {
  const { cities } = useCities()
  const isNew = !city
  const geocodingLib = useMapsLibrary('geocoding')

  const [name, setName] = useState(city?.name ?? '')
  const [department, setDepartment] = useState(city?.department ?? '')
  const [enabled, setEnabled] = useState(city?.enabled ?? false)
  const [zones, setZones] = useState<{ bounds: Bounds; viewBounds: Bounds } | null>(
    city ? { bounds: city.bounds, viewBounds: city.viewBounds } : null,
  )
  // Cambia cuando se busca otra ciudad, para reiniciar los rectángulos editables.
  const [zonesKey, setZonesKey] = useState(0)
  const live = useRef(zones)
  live.current = zones

  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const id = city?.id ?? slugify(name)

  const search = async () => {
    if (!geocodingLib || !name.trim()) return
    setSearching(true)
    setErr(null)
    try {
      const { results } = await new geocodingLib.Geocoder().geocode({
        address: `${name.trim()}, Perú`,
        region: 'pe',
        componentRestrictions: { country: 'PE' },
      })
      const best = results[0]
      if (!best) throw new Error('sin resultados')
      const vp = best.geometry.viewport.toJSON()
      const dep = best.address_components.find((a) => a.types.includes('administrative_area_level_1'))?.long_name ?? ''
      setDepartment(dep.replace(/^Departamento de /i, '').replace(/^Provincia de /i, ''))
      setZones({ viewBounds: round(vp), bounds: round(expand(vp, 0.5)) })
      setZonesKey((k) => k + 1)
    } catch (e) {
      console.error(e)
      setErr('No encontramos esa ciudad. Prueba con otro nombre (por ejemplo, "Moquegua" o "Arequipa").')
    } finally {
      setSearching(false)
    }
  }

  const save = async () => {
    const z = live.current
    if (!z || !name.trim()) return
    setErr(null)
    if (isNew && cities.some((c) => c.id === id)) {
      setErr('Ya existe una ciudad con ese nombre.')
      return
    }
    if (!insidePeru(z.bounds)) {
      setErr('La zona de reportes debe quedar dentro del Perú.')
      return
    }
    setSaving(true)
    try {
      await saveCity(
        {
          id,
          name: name.trim(),
          department: department.trim(),
          enabled,
          bounds: round(z.bounds),
          viewBounds: round(z.viewBounds),
          center: {
            lat: +((z.viewBounds.north + z.viewBounds.south) / 2).toFixed(5),
            lng: +((z.viewBounds.east + z.viewBounds.west) / 2).toFixed(5),
          },
          order: city?.order ?? Math.max(-1, ...cities.map((c) => c.order)) + 1,
        },
        isNew,
      )
      onBack()
    } catch (e) {
      console.error(e)
      setErr('No se pudo guardar. Revisa que las reglas de Firestore estén publicadas.')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <button onClick={onBack} className="icon-btn h-10 w-10" aria-label="Volver a la lista">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-2xl font-semibold">{isNew ? 'Nueva ciudad' : `Editar ${city.name}`}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && isNew && search()}
            placeholder="Nombre de la ciudad, ej. Moquegua"
            className="field py-2.5"
            maxLength={60}
            autoFocus={isNew}
          />
          {isNew && (
            <button onClick={search} disabled={!name.trim() || searching || !geocodingLib} className="btn-soft shrink-0 px-4 py-2.5">
              {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </button>
          )}
        </div>

        {zones ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border-2 border-coral bg-coral/20" /> Zona de reportes (incluye alrededores)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border-2 border-lavender-shade bg-lavender/20" /> Zona urbana (vista "Toda la ciudad")
              </span>
            </div>
            <div className="relative h-72 overflow-hidden rounded-[24px] sm:h-80">
              <ZonesMap key={zonesKey} zones={zones} onChange={(z) => (live.current = z)} />
            </div>
            <p className="text-xs text-ink-muted">Arrastra los bordes de cada rectángulo para ajustar las zonas.</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-ink-soft">Departamento</span>
                <input value={department} onChange={(e) => setDepartment(e.target.value)} className="field py-2" maxLength={40} />
              </label>
              <div className="text-sm">
                <span className="mb-1 block font-semibold text-ink-soft">Estado</span>
                <button
                  onClick={() => setEnabled((v) => !v)}
                  role="switch"
                  aria-checked={enabled}
                  className={`w-full rounded-2xl border-2 px-4 py-2 text-left font-semibold transition ${
                    enabled ? 'border-mint bg-mint-soft text-mint-deep' : 'border-line bg-white text-ink-muted'
                  }`}
                >
                  {enabled ? '✓ Activa: se puede reportar' : 'Pausada: aún no se puede reportar'}
                </button>
              </div>
            </div>
            {isNew && name.trim() && (
              <p className="text-xs text-ink-muted">
                Identificador: <code className="rounded bg-lavender-soft px-1 text-lavender-deep">{id}</code> (no se puede cambiar después)
              </p>
            )}
          </>
        ) : (
          <div className="grid h-56 place-items-center rounded-[24px] bg-cream-200 text-center text-sm text-ink-muted">
            <span>
              <MapPinned className="mx-auto mb-2 h-7 w-7" />
              Escribe el nombre y pulsa <b>Buscar</b> para ubicar la ciudad.
            </span>
          </div>
        )}

        {err && <p className="rounded-2xl bg-coral-soft px-4 py-2 text-sm text-coral-deep">{err}</p>}
      </div>

      <div className="border-t-2 border-line px-5 py-4">
        <button className="btn-primary w-full" onClick={save} disabled={!zones || !name.trim() || !id || saving}>
          {saving && <LoaderCircle className="h-5 w-5 animate-spin" />}
          {isNew ? 'Guardar ciudad' : 'Guardar cambios'}
        </button>
      </div>
    </>
  )
}

function insidePeru(b: Bounds) {
  return b.north > b.south && b.east > b.west && b.north <= PERU_BOUNDS.north && b.south >= PERU_BOUNDS.south && b.east <= PERU_BOUNDS.east && b.west >= PERU_BOUNDS.west
}

function ZonesMap({
  zones,
  onChange,
}: {
  zones: { bounds: Bounds; viewBounds: Bounds }
  onChange: (z: { bounds: Bounds; viewBounds: Bounds }) => void
}) {
  const current = useRef(zones)
  const initial = useMemo(() => zones, []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (key: 'bounds' | 'viewBounds', b: google.maps.LatLngBounds | null | undefined) => {
    if (!b) return
    current.current = { ...current.current, [key]: b.toJSON() }
    onChange(current.current)
  }

  return (
    <Map
      className="absolute inset-0"
      mapId={MAP_ID}
      colorScheme={ColorScheme.LIGHT}
      defaultBounds={{ ...initial.bounds, padding: 16 }}
      gestureHandling="greedy"
      disableDefaultUI
      clickableIcons={false}
    >
      <Rectangle
        defaultBounds={initial.bounds}
        editable
        draggable
        strokeColor="#E86F5A"
        strokeWeight={2}
        fillColor="#FF8E7A"
        fillOpacity={0.12}
        onBoundsChanged={(b) => update('bounds', b)}
      />
      <Rectangle
        defaultBounds={initial.viewBounds}
        editable
        draggable
        strokeColor="#9886F0"
        strokeWeight={2}
        fillColor="#B5A6FF"
        fillOpacity={0.15}
        onBoundsChanged={(b) => update('viewBounds', b)}
      />
    </Map>
  )
}

function Header({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-5 pb-4 pt-5">
      <div className="flex-1">
        <p className="font-display text-2xl font-semibold leading-tight">{title}</p>
        <p className="text-sm text-ink-muted">{subtitle}</p>
      </div>
      <button onClick={onClose} className="icon-btn h-10 w-10" aria-label="Cerrar">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Download, LoaderCircle, LogOut, Search, Trash2, Users, X } from 'lucide-react'
import { useMap } from '@vis.gl/react-google-maps'
import { useAuth } from '../../context/AuthContext'
import { useCities } from '../../context/CitiesContext'
import { backfillReportCities, cityExists, saveCity } from '../../lib/cities'
import { boundsContain } from '../../lib/geo'
import { CitiesManager } from './CitiesManager'
import { useReports } from '../../hooks/useReports'
import { ReportsMap } from '../../components/ReportsMap'
import { ReportDetail } from '../../components/ReportDetail'
import { SeverityBadge, StatusBadge } from '../../components/Badges'
import { PinMark } from '../../components/Logo'
import { exportReportsCsv } from '../../lib/csv'
import { timeAgo } from '../../lib/format'
import { deleteReport, updateReportStatus } from '../../lib/reports'
import { SEVERITIES, SEVERITY_META, STATUSES, STATUS_META, TACNA_CITY } from '../../lib/types'
import type { City, Report, ReportStatus, Severity } from '../../lib/types'

type Period = '7' | '30' | 'all'
type Sort = 'recent' | 'confirmed' | 'severity'

const SEVERITY_RANK: Record<Severity, number> = { peligroso: 3, mediano: 2, pequeno: 1 }

export default function AdminPage() {
  const { user, signOutUser } = useAuth()
  const { reports, loading, error } = useReports()
  const { cities, seeded, loading: citiesLoading, cityName } = useCities()

  const [cityFilter, setCityFilter] = useState<string>('all')
  const [citiesOpen, setCitiesOpen] = useState(false)
  const cityOf = (r: Report) => r.cityId ?? cities.find((c) => boundsContain(c.bounds, r))?.id ?? null
  const selectedCity = cities.find((c) => c.id === cityFilter) ?? null

  // Primera vez: crea la ciudad inicial (Tacna) en Firestore.
  const seeding = useRef(false)
  useEffect(() => {
    if (citiesLoading || seeded || seeding.current) return
    seeding.current = true
    cityExists(TACNA_CITY.id)
      .then((exists) => (exists ? undefined : saveCity(TACNA_CITY, true)))
      .catch((e) => console.error('No se pudo crear la ciudad inicial', e))
  }, [citiesLoading, seeded])

  // Reportes creados antes de existir las ciudades: se les asigna su ciudad según su ubicación.
  const backfilled = useRef(false)
  useEffect(() => {
    if (!seeded || loading || backfilled.current || !reports.some((r) => !r.cityId)) return
    backfilled.current = true
    backfillReportCities(reports, cities)
      .then((n) => n && console.info(`Ciudad asignada a ${n} reportes antiguos`))
      .catch((e) => console.error('No se pudo asignar la ciudad a reportes antiguos', e))
  }, [seeded, loading, reports, cities])

  const cityReports = useMemo(
    () => (cityFilter === 'all' ? reports : reports.filter((r) => cityOf(r) === cityFilter)),
    [reports, cityFilter, cities], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [statusFilter, setStatusFilter] = useState<Set<ReportStatus>>(new Set(['pendiente', 'verificado']))
  const [sevFilter, setSevFilter] = useState<Set<Severity>>(new Set(SEVERITIES))
  const [period, setPeriod] = useState<Period>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c: Record<ReportStatus, number> = { pendiente: 0, verificado: 0, reparado: 0 }
    cityReports.forEach((r) => c[r.status]++)
    return c
  }, [cityReports])

  const filtered = useMemo(() => {
    const since = period === 'all' ? 0 : Date.now() - Number(period) * 86400000
    const q = search.trim().toLowerCase()
    const list = cityReports.filter(
      (r) =>
        statusFilter.has(r.status) &&
        sevFilter.has(r.severity) &&
        (r.createdAt?.getTime() ?? Date.now()) >= since &&
        (!q || r.address?.toLowerCase().includes(q) || r.note.toLowerCase().includes(q)),
    )
    if (sort === 'confirmed') list.sort((a, b) => b.confirmations - a.confirmations)
    if (sort === 'severity') list.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.confirmations - a.confirmations)
    return list
  }, [cityReports, statusFilter, sevFilter, period, sort, search])

  const selected = reports.find((r) => r.id === selectedId) ?? null

  return (
    <div className="flex h-dvh flex-col bg-cream-100 text-ink lg:flex-row">
      {/* Sidebar */}
      <aside className="z-10 flex max-h-[55dvh] min-h-0 flex-col bg-cream-50 shadow-float lg:max-h-none lg:w-[410px]">
        <div className="flex items-center gap-3 px-5 pt-4">
          <Link to="/" className="shrink-0">
            <PinMark size={30} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-semibold leading-none">Panel de control</p>
            <p className="truncate text-xs text-ink-muted">{user?.email}</p>
          </div>
          <button onClick={() => setCitiesOpen(true)} className="icon-btn" title="Ciudades" aria-label="Administrar ciudades">
            <Building2 className="h-4 w-4" />
          </button>
          <button onClick={signOutUser} className="icon-btn" title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Ciudad */}
        <div className="px-5 pt-4">
          <CitySelect cities={cities} value={cityFilter} onChange={setCityFilter} reports={reports} cityOf={cityOf} />
        </div>

        {/* Contadores = filtros de estado */}
        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          {STATUSES.map((s) => {
            const on = statusFilter.has(s)
            const meta = STATUS_META[s]
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(toggle(statusFilter, s))}
                className={`rounded-[20px] border-2 px-3 py-2.5 text-left transition active:scale-95 ${on ? '' : 'border-line bg-white opacity-60'}`}
                style={on ? { background: meta.soft, borderColor: meta.color } : undefined}
              >
                <p className="font-display text-3xl font-semibold leading-none tabular" style={{ color: meta.deep }}>
                  {counts[s]}
                </p>
                <p className="mt-1 text-xs font-semibold text-ink-soft">{meta.label}</p>
              </button>
            )
          })}
        </div>

        <div className="space-y-3 px-5 pt-4">
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((s) => {
              const on = sevFilter.has(s)
              return (
                <button
                  key={s}
                  onClick={() => setSevFilter(toggle(sevFilter, s))}
                  className={`chip ${on ? '' : 'border-line bg-white text-ink-faint'}`}
                  style={on ? { borderColor: SEVERITY_META[s].color, background: SEVERITY_META[s].soft, color: SEVERITY_META[s].deep } : undefined}
                >
                  {SEVERITY_META[s].emoji} {SEVERITY_META[s].label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar calle o nota…"
                className="field py-2 pl-10 text-sm"
              />
            </label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="field w-auto py-2 text-sm">
              <option value="7">7 días</option>
              <option value="30">30 días</option>
              <option value="all">Todo</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field w-auto py-2 text-sm">
              <option value="recent">Más recientes</option>
              <option value="confirmed">Más confirmados</option>
              <option value="severity">Más graves</option>
            </select>
            <button
              onClick={() => exportReportsCsv(filtered, (r) => cityName(cityOf(r)), selectedCity?.id)}
              disabled={!filtered.length}
              className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-bold text-ink shadow-[0_3px_0_#E86F5A] transition active:translate-y-0.5 active:shadow-none disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> CSV ({filtered.length})
            </button>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto border-t-2 border-line">
          {loading ? (
            <div className="grid place-items-center py-16">
              <LoaderCircle className="h-6 w-6 animate-spin text-coral" />
            </div>
          ) : error ? (
            <p className="p-5 text-sm text-coral-deep">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-muted">
              <span className="mb-2 block text-3xl">🔍</span>
              No hay reportes con estos filtros.
            </p>
          ) : (
            <ul className="space-y-1 p-2">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={`flex w-full gap-3 rounded-[20px] px-3 py-2.5 text-left transition hover:bg-white ${
                      r.id === selectedId ? 'bg-white shadow-card ring-2 ring-coral' : ''
                    }`}
                  >
                    <img src={r.photos[0]?.url} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-cream-200 object-cover" loading="lazy" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold">{r.address ?? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={r.status} />
                        <SeverityBadge severity={r.severity} />
                      </div>
                      <p className="flex items-center gap-2 text-[11px] text-ink-muted">
                        {cityFilter === 'all' && cities.length > 1 && <span className="font-semibold text-ink-soft">{cityName(cityOf(r))} ·</span>}
                        {timeAgo(r.createdAt)}
                        {r.confirmations > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-lavender-deep">
                            <Users className="h-3 w-3" /> {r.confirmations}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Mapa + detalle */}
      <section className="relative min-h-0 flex-1">
        <ReportsMap className="absolute inset-0" reports={filtered} selectedId={selectedId} onSelect={(r) => setSelectedId(r.id)}>
          <FitCity city={selectedCity} />
        </ReportsMap>
        <Legend />
        {selected && <AdminDetail key={selected.id} report={selected} onClose={() => setSelectedId(null)} />}
        <CitiesManager open={citiesOpen} onClose={() => setCitiesOpen(false)} reports={reports} />
      </section>
    </div>
  )
}

function CitySelect({
  cities,
  value,
  onChange,
  reports,
  cityOf,
}: {
  cities: City[]
  value: string
  onChange: (v: string) => void
  reports: Report[]
  cityOf: (r: Report) => string | null
}) {
  const count = (id: string) => reports.filter((r) => cityOf(r) === id).length
  return (
    <label className="relative block">
      <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-lavender-deep" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field appearance-none py-2.5 pl-10 font-semibold"
        aria-label="Filtrar por ciudad"
      >
        <option value="all">Todas las ciudades ({reports.length})</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({count(c.id)}){c.enabled ? '' : ' · pausada'}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Al elegir una ciudad, el mapa encuadra su zona urbana. */
function FitCity({ city }: { city: City | null }) {
  const map = useMap()
  useEffect(() => {
    if (map && city) map.fitBounds(city.viewBounds, 40)
  }, [map, city?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function toggle<T>(set: Set<T>, value: T) {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 hidden gap-3 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold shadow-soft backdrop-blur sm:flex">
      {STATUSES.map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-ink-soft">
          <span className="h-3 w-3 rounded-full border-2 border-white" style={{ background: STATUS_META[s].color, boxShadow: '0 0 0 1px #F0E5DA' }} />
          {STATUS_META[s].label}
        </span>
      ))}
    </div>
  )
}

function AdminDetail({ report, onClose }: { report: Report; onClose: () => void }) {
  const [saving, setSaving] = useState<ReportStatus | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const setStatus = async (s: ReportStatus) => {
    if (s === report.status) return
    setSaving(s)
    setErr(null)
    try {
      await updateReportStatus(report.id, s)
    } catch (e) {
      console.error(e)
      setErr('No se pudo actualizar el estado.')
    } finally {
      setSaving(null)
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteReport(report)
      onClose()
    } catch (e) {
      console.error(e)
      setErr('No se pudo eliminar.')
      setDeleting(false)
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 max-h-[85%] overflow-y-auto rounded-t-[32px] bg-cream-50 shadow-float animate-pop sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:max-h-[calc(100%-2rem)] sm:w-[390px] sm:rounded-[32px]">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-cream-50/95 px-5 py-3 backdrop-blur">
        <p className="tabular text-xs text-ink-faint">#{report.id.slice(0, 8)}</p>
        <button onClick={onClose} className="icon-btn h-10 w-10" aria-label="Cerrar detalle">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ReportDetail
        report={report}
        tallPhotos
        actions={
          <div className="space-y-3">
            <div>
              <p className="mb-2 font-display font-medium text-ink">Cambiar estado</p>
              <div className="grid grid-cols-3 gap-1 rounded-full bg-white p-1 shadow-card">
                {STATUSES.map((s) => {
                  const active = s === report.status
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      disabled={!!saving}
                      className="flex items-center justify-center gap-1 rounded-full py-2 text-xs font-bold transition active:scale-95"
                      style={active ? { background: STATUS_META[s].color, color: '#2F2B3A' } : { color: '#8C8698' }}
                    >
                      {saving === s && <LoaderCircle className="h-3 w-3 animate-spin" />}
                      {STATUS_META[s].label}
                    </button>
                  )
                })}
              </div>
            </div>
            {err && <p className="text-xs text-coral-deep">{err}</p>}
            {confirmDelete ? (
              <div className="flex gap-2">
                <button className="btn-soft flex-1" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancelar
                </button>
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-coral-deep py-3 text-sm font-bold text-white disabled:opacity-60"
                  onClick={remove}
                  disabled={deleting}
                >
                  {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Eliminar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold text-ink-muted hover:text-coral-deep"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar reporte (spam / falso)
              </button>
            )}
          </div>
        }
      />
    </div>
  )
}

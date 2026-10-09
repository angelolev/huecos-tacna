import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Download, LoaderCircle, Search, Users } from 'lucide-react'
import { SeverityBadge, StatusBadge } from '../../components/Badges'
import { CHAMPION_RING, championLabel } from '../../components/ChampionBadge'
import { exportNeighborsCsv } from '../../lib/csv'
import { timeAgo } from '../../lib/format'
import { hotZones, neighborMetrics, neighborName, neighbors, priorityQueue, reportMetrics, trend } from '../../lib/metrics'
import type { MetricsPeriod, Neighbor, TrendBucket, TrendUnit } from '../../lib/metrics'
import { monthlyChampions, titlesByUid } from '../../lib/points'
import type { Champion, Confirmation, GoogleBonus, PointEvent } from '../../lib/points'
import { SEVERITIES, SEVERITY_META } from '../../lib/types'
import type { Profile, Report } from '../../lib/types'

const PERIODS: { id: MetricsPeriod; label: string; prev: string }[] = [
  { id: '7', label: '7 días', prev: 'los 7 días anteriores' },
  { id: '30', label: '30 días', prev: 'los 30 días anteriores' },
  { id: '90', label: '90 días', prev: 'los 90 días anteriores' },
  { id: 'all', label: 'Todo', prev: '' },
]

// Series de la tendencia (validadas para daltonismo y contraste sobre blanco).
const CREATED_COLOR = '#D9563F'
const FIXED_COLOR = '#2672B5'

type NeighborSort = 'reports' | 'points' | 'recent' | 'rejected'

const nf = new Intl.NumberFormat('es-PE')
const plural = (n: number, one: string, many: string) => `${nf.format(n)} ${n === 1 ? one : many}`
// Lo más grave primero.
const SEVERITY_ORDER = [...SEVERITIES].reverse()
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
const days = (x: number | null) => (x === null ? '—' : x < 1 ? 'menos de 1 día' : `${x < 10 ? x.toFixed(1).replace('.', ',') : Math.round(x)} días`)

interface Props {
  /** Reportes de la ciudad elegida (o todos). */
  cityReports: Report[]
  /** Todos los reportes (para saber en qué ciudad participa cada vecino). */
  reports: Report[]
  cityId: string | null
  cityOf: (r: Report) => string | null
  cityName: (id: string | null) => string
  points: {
    events: PointEvent[]
    confirmations: Confirmation[]
    bonuses: GoogleBonus[]
    profiles: Map<string, Profile>
    loading: boolean
  }
  loading: boolean
  onOpenReport: (r: Report) => void
}

export function MetricsView({ cityReports, reports, cityId, cityOf, cityName, points, loading, onOpenReport }: Props) {
  const [period, setPeriod] = useState<MetricsPeriod>('30')
  const periodMeta = PERIODS.find((p) => p.id === period)!

  const m = useMemo(() => reportMetrics(cityReports, points.confirmations, period), [cityReports, points.confirmations, period])
  const t = useMemo(() => trend(cityReports, period), [cityReports, period])
  const queue = useMemo(() => priorityQueue(cityReports), [cityReports])
  const zones = useMemo(() => hotZones(cityReports), [cityReports])
  const people = useMemo(
    () =>
      neighbors({
        reports,
        confirmations: points.confirmations,
        bonuses: points.bonuses,
        profiles: points.profiles,
        events: points.events,
        cityOf,
        cityId,
        period,
      }),
    [reports, points, cityOf, cityId, period],
  )
  const nm = useMemo(() => neighborMetrics(people, period), [people, period])
  const titles = useMemo(() => titlesByUid(monthlyChampions(points.events, points.profiles)), [points.events, points.profiles])

  if (loading) {
    return (
      <div className="grid flex-1 place-items-center py-24">
        <LoaderCircle className="h-7 w-7 animate-spin text-coral" />
      </div>
    )
  }

  const delta = m.receivedPrev === null ? null : m.received - m.receivedPrev

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-16 pt-5 sm:px-6">
      {/* Periodo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {cityId ? cityName(cityId) : 'Todas las ciudades'} · se actualiza en tiempo real
        </p>
        <div className="flex gap-1 rounded-full bg-white p-1 shadow-soft" role="tablist" aria-label="Periodo">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                period === p.id ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Reportes ── */}
      <section className="space-y-4">
        <SectionTitle emoji="🚧" title="Reportes" hint="Lo que los vecinos están detectando y cuánto se está resolviendo." />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Recibidos"
            value={nf.format(m.received)}
            foot={
              delta === null ? (
                'desde el inicio'
              ) : (
                <span className="inline-flex items-center gap-0.5">
                  {delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : delta < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                  {delta === 0 ? 'igual que' : `${delta > 0 ? '+' : ''}${nf.format(delta)} vs`} {periodMeta.prev}
                </span>
              )
            }
          />
          <Stat label="Por atender" value={nf.format(m.active)} foot={`${plural(m.activeDangerous, 'peligroso', 'peligrosos')} 😱`} accent={m.activeDangerous > 0} />
          <Stat label="Reparados" value={nf.format(m.fixedInPeriod)} foot="en el periodo" />
          <Stat label="Tasa de resolución" value={pct(m.resolutionRate)} foot="de los recibidos ya están reparados" />
          <Stat label="Tiempo de reparación" value={days(m.medianRepairDays)} foot="mediana, del reporte a reparado" small />
          <Stat label="Reportes falsos" value={pct(m.rejectedRate)} foot={`${plural(m.rejected, 'marcado', 'marcados')} como falso${m.rejected === 1 ? '' : 's'}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Nuevos vs. reparados" hint={unitHint(t.unit)}>
            <TrendChart buckets={t.buckets} unit={t.unit} />
          </Card>
          <Card title="Pendientes por antigüedad" hint="Cuánto tiempo llevan esperando los huecos sin reparar.">
            <HBars
              rows={m.aging.map((a) => ({
                label: a.label,
                value: a.count,
                note: a.dangerous ? plural(a.dangerous, 'peligroso', 'peligrosos') : undefined,
                color: '#D9563F',
              }))}
            />
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Por severidad</p>
            <HBars
              rows={SEVERITY_ORDER.map((s) => ({
                label: `${SEVERITY_META[s].emoji} ${SEVERITY_META[s].label}`,
                value: m.bySeverity[s],
                color: SEVERITY_META[s].deep,
              }))}
            />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Atender primero" hint="Pendientes ordenados por severidad, apoyo de vecinos y antigüedad.">
            {queue.length === 0 ? (
              <Empty text="No hay huecos pendientes 🎉" />
            ) : (
              <ol className="-mx-2 space-y-1">
                {queue.map(({ report: r }, i) => (
                  <li key={r.id}>
                    <button
                      onClick={() => onOpenReport(r)}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-cream-100"
                    >
                      <span className="w-5 shrink-0 text-center font-display text-sm font-semibold text-ink-muted tabular">{i + 1}</span>
                      <img src={r.photos[0]?.url} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-cream-200 object-cover" loading="lazy" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.address?.split(',')[0] ?? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                          <SeverityBadge severity={r.severity} />
                          <StatusBadge status={r.status} />
                          {timeAgo(r.createdAt)}
                          {r.confirmations > 0 && (
                            <span className="inline-flex items-center gap-0.5 font-semibold text-lavender-deep">
                              <Users className="h-3 w-3" /> {r.confirmations}
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card title="Zonas con más huecos" hint="Pendientes agrupados por zona (~1 km). Útil para planificar cuadrillas.">
            {zones.length === 0 ? (
              <Empty text="No hay huecos pendientes 🎉" />
            ) : (
              <ul className="-mx-2 space-y-1">
                {zones.map((z) => (
                  <li key={z.key}>
                    <button
                      onClick={() => onOpenReport(z.top)}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-cream-100"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-coral-soft font-display text-lg font-semibold text-coral-deep tabular">
                        {z.count}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{z.label}</span>
                        <span className="text-[11px] text-ink-muted">
                          {plural(z.count, 'pendiente', 'pendientes')}
                          {z.dangerous > 0 && ` · ${plural(z.dangerous, 'peligroso', 'peligrosos')}`}
                          {z.confirmations > 0 && ` · ${plural(z.confirmations, 'apoyo', 'apoyos')}`}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      {/* ── Vecinos ── */}
      <section className="space-y-4">
        <SectionTitle emoji="🙋" title="Vecinos" hint="Quiénes están reportando y qué tan comprometidos están." />
        {points.loading ? (
          <div className="grid place-items-center py-12">
            <LoaderCircle className="h-6 w-6 animate-spin text-coral" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Stat label="Vecinos" value={nf.format(nm.known)} foot={cityId ? 'participaron en esta ciudad' : 'reportaron, confirmaron o crearon cuenta'} />
              <Stat label="Activos" value={nf.format(nm.activeInPeriod)} foot="reportaron o confirmaron en el periodo" />
              <Stat label="Nuevos" value={nf.format(nm.newInPeriod)} foot="llegaron en el periodo" />
              <Stat label="Con Google" value={nf.format(nm.google)} foot={`${pct(nm.known ? nm.google / nm.known : null)} del total`} />
              <Stat label="Recurrentes" value={nf.format(nm.recurrent)} foot="participaron 2 veces o más" />
              <Stat label="Confirmaciones" value={nf.format(m.confirmations)} foot="apoyos a reportes en el periodo" />
            </div>
            <NeighborsTable rows={people} showCity={!cityId} cityName={cityName} cityId={cityId} titles={titles} />
          </>
        )}
        <p className="text-xs text-ink-muted">
          Solo se cuentan vecinos que reportaron, confirmaron, tienen alias o entraron con Google: quien solo miró el mapa no deja
          rastro. Nunca se muestran nombres reales ni correos.
        </p>
      </section>
    </div>
  )
}

function unitHint(unit: TrendUnit) {
  return unit === 'day' ? 'Por día.' : unit === 'week' ? 'Por semana (desde el lunes).' : 'Por mes.'
}

function SectionTitle({ emoji, title, hint }: { emoji: string; title: string; hint: string }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold">
        {emoji} {title}
      </h2>
      <p className="text-sm text-ink-muted">{hint}</p>
    </div>
  )
}

function Card({ title, hint, className = '', children }: { title: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`card min-w-0 p-5 ${className}`}>
      <p className="font-display text-lg font-semibold">{title}</p>
      {hint && <p className="mb-4 text-xs text-ink-muted">{hint}</p>}
      {children}
    </div>
  )
}

function Stat({ label, value, foot, accent, small }: { label: string; value: string; foot?: ReactNode; accent?: boolean; small?: boolean }) {
  return (
    <div className={`card min-w-0 px-4 py-3.5 ${accent ? 'ring-2 ring-coral-soft' : ''}`}>
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className={`mt-1 font-display font-semibold leading-tight text-ink ${small ? 'text-xl' : 'text-3xl'}`}>{value}</p>
      {foot && <p className="mt-1 text-[11px] leading-snug text-ink-muted">{foot}</p>}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-ink-muted">{text}</p>
}

/** Barras horizontales de una sola serie, con el valor al final. */
function HBars({ rows }: { rows: { label: string; value: number; note?: string; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold text-ink-soft">{r.label}</span>
            <span className="text-ink-muted">
              <b className="text-ink tabular">{r.value}</b>
              {r.note && ` · ${r.note}`}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-cream-200">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 6 : 0, background: r.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

const dayFmt = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' })
const monthFmt = new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit' })

function bucketLabel(b: TrendBucket, unit: TrendUnit) {
  return unit === 'month' ? monthFmt.format(b.start) : dayFmt.format(b.start)
}

function bucketTitle(b: TrendBucket, unit: TrendUnit) {
  if (unit === 'day') return dayFmt.format(b.start)
  if (unit === 'month') return new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(b.start)
  return `Semana del ${dayFmt.format(b.start)}`
}

/** Escala "limpia": 0, paso, 2·paso… con pasos 1, 2, 5, 10… */
function niceScale(max: number) {
  const raw = Math.max(1, max) / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return { top, ticks }
}

function TrendChart({ buckets, unit }: { buckets: TrendBucket[]; unit: TrendUnit }) {
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const { top, ticks } = niceScale(Math.max(...buckets.map((b) => Math.max(b.created, b.fixed))))
  const every = Math.ceil(buckets.length / 7)
  const totals = buckets.reduce((s, b) => ({ created: s.created + b.created, fixed: s.fixed + b.fixed }), { created: 0, fixed: 0 })

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        <Key color={CREATED_COLOR} label={`Nuevos (${totals.created})`} />
        <Key color={FIXED_COLOR} label={`Reparados (${totals.fixed})`} />
        <button onClick={() => setAsTable(!asTable)} className="ml-auto font-semibold text-sky-deep">
          {asTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-64 overflow-auto rounded-2xl border-2 border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cream-100 text-left text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Periodo</th>
                <th className="px-3 py-2 text-right font-semibold">Nuevos</th>
                <th className="px-3 py-2 text-right font-semibold">Reparados</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {buckets.map((b) => (
                <tr key={b.start.getTime()} className="border-t border-line">
                  <td className="px-3 py-1.5">{bucketTitle(b, unit)}</td>
                  <td className="px-3 py-1.5 text-right">{b.created}</td>
                  <td className="px-3 py-1.5 text-right">{b.fixed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2 pt-2">
          {/* Eje Y */}
          <div className="relative h-48 w-6 shrink-0 text-right text-[10px] text-ink-muted tabular">
            {ticks.map((v) => (
              <span key={v} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(v / top) * 100}%` }}>
                {v}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative h-48" onMouseLeave={() => setHover(null)}>
              {ticks.map((v) => (
                <div key={v} className="absolute inset-x-0 h-px bg-line" style={{ bottom: `${(v / top) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end">
                {buckets.map((b, i) => (
                  <div
                    key={b.start.getTime()}
                    className={`relative flex h-full flex-1 items-end justify-center gap-[2px] px-[1px] ${hover === i ? 'bg-cream-100' : ''}`}
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setHover(i)}
                  >
                    <Bar value={b.created} top={top} color={CREATED_COLOR} />
                    <Bar value={b.fixed} top={top} color={FIXED_COLOR} />
                  </div>
                ))}
              </div>
              {hover !== null && (
                <div
                  className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-2xl bg-ink px-3 py-2 text-xs text-white shadow-float"
                  style={{ left: `${Math.min(85, Math.max(15, ((hover + 0.5) / buckets.length) * 100))}%` }}
                >
                  <p className="mb-1 font-semibold">{bucketTitle(buckets[hover], unit)}</p>
                  <p className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: CREATED_COLOR }} /> Nuevos: <b>{buckets[hover].created}</b>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: FIXED_COLOR }} /> Reparados: <b>{buckets[hover].fixed}</b>
                  </p>
                </div>
              )}
            </div>
            {/* Eje X: solo algunas etiquetas para que no choquen */}
            <div className="mt-1.5 flex text-[10px] text-ink-muted">
              {buckets.map((b, i) => (
                <span key={b.start.getTime()} className="flex-1 whitespace-nowrap text-center">
                  {i % every === 0 ? bucketLabel(b, unit) : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Bar({ value, top, color }: { value: number; top: number; color: string }) {
  return (
    <div
      className="w-full max-w-[14px] rounded-t-[4px]"
      style={{ height: value ? `max(${(value / top) * 100}%, 3px)` : 0, background: color }}
    />
  )
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  )
}

const SORTS: { id: NeighborSort; label: string }[] = [
  { id: 'reports', label: 'Más reportes' },
  { id: 'points', label: 'Más puntos' },
  { id: 'recent', label: 'Actividad reciente' },
  { id: 'rejected', label: 'Más reportes falsos' },
]

function NeighborsTable({
  rows,
  showCity,
  cityName,
  cityId,
  titles,
}: {
  titles: Map<string, Champion[]>
  rows: Neighbor[]
  showCity: boolean
  cityName: (id: string | null) => string
  cityId: string | null
}) {
  const [sort, setSort] = useState<NeighborSort>('reports')
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)

  const sorted = useMemo(() => {
    const query = q.trim().toLowerCase()
    const list = rows.filter((n) => !query || neighborName(n).toLowerCase().includes(query))
    const by: Record<NeighborSort, (a: Neighbor, b: Neighbor) => number> = {
      reports: (a, b) => b.reports - a.reports || b.confirmationsGiven - a.confirmationsGiven || b.points - a.points,
      points: (a, b) => b.points - a.points,
      recent: (a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0),
      rejected: (a, b) => b.rejected - a.rejected || b.reports - a.reports,
    }
    return list.sort(by[sort])
  }, [rows, sort, q])
  const visible = all ? sorted : sorted.slice(0, 25)

  return (
    <div className="card min-w-0 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="mr-auto font-display text-lg font-semibold">Vecinos más activos</p>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alias…" className="field w-44 py-2 pl-9 text-sm" />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as NeighborSort)} className="field w-auto py-2 text-sm" aria-label="Ordenar vecinos">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => exportNeighborsCsv(sorted, cityName, cityId ?? undefined)}
          disabled={!sorted.length}
          className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-bold text-ink shadow-[0_3px_0_#E86F5A] transition active:translate-y-0.5 active:shadow-none disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>

      {sorted.length === 0 ? (
        <Empty text="Todavía no hay vecinos con actividad aquí." />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-ink-muted">
              <tr className="border-b-2 border-line">
                <th className="py-2 pl-5 pr-2 font-semibold">Vecino</th>
                {showCity && <th className="px-2 py-2 font-semibold">Ciudad</th>}
                <th className="px-2 py-2 text-right font-semibold">Reportes</th>
                <th className="px-2 py-2 text-right font-semibold">Reparados</th>
                <th className="px-2 py-2 text-right font-semibold">Falsos</th>
                <th className="px-2 py-2 text-right font-semibold">Confirmó</th>
                <th className="px-2 py-2 text-right font-semibold">Puntos</th>
                <th className="py-2 pl-2 pr-5 text-right font-semibold">Última actividad</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {visible.map((n) => {
                const suspicious = n.rejected >= 2 && n.rejected / Math.max(1, n.reports) >= 0.5
                const won = titles.get(n.uid) ?? []
                return (
                  <tr key={n.uid} className="border-b border-line last:border-0">
                    <td className="py-2 pl-5 pr-2">
                      <span className="flex items-center gap-2">
                        <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cream-200 text-base ${won.length ? CHAMPION_RING : ''}`}>
                          {n.profile?.emoji ?? '👤'}
                        </span>
                        <span className="min-w-0">
                          {n.profile ? (
                            <a
                              href={`/vecino/${n.uid}`}
                              target="_blank"
                              rel="noreferrer"
                              className={`block truncate font-semibold hover:underline ${won.length ? 'text-butter-deep' : 'text-ink'}`}
                            >
                              {won.length > 0 && '👑 '}
                              {neighborName(n)}
                            </a>
                          ) : (
                            <span className="block truncate font-semibold text-ink-muted">{neighborName(n)}</span>
                          )}
                          <span className="text-[11px] text-ink-muted">
                            {n.google ? 'Cuenta Google' : 'Sin cuenta'}
                            {won.length > 0 && ` · 👑 ${championLabel(won)}`}
                          </span>
                        </span>
                      </span>
                    </td>
                    {showCity && <td className="px-2 py-2 text-ink-soft">{n.cityId ? cityName(n.cityId) : '—'}</td>}
                    <td className="px-2 py-2 text-right font-semibold">{n.reports}</td>
                    <td className="px-2 py-2 text-right">{n.fixed}</td>
                    <td className={`px-2 py-2 text-right ${suspicious ? 'font-bold text-coral-deep' : ''}`} title={suspicious ? 'La mitad o más de sus reportes fueron falsos' : undefined}>
                      {n.rejected}
                      {suspicious && ' ⚠️'}
                    </td>
                    <td className="px-2 py-2 text-right">{n.confirmationsGiven}</td>
                    <td className="px-2 py-2 text-right font-semibold">{n.points}</td>
                    <td className="py-2 pl-2 pr-5 text-right text-ink-muted">{n.lastAt ? timeAgo(n.lastAt) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {sorted.length > 25 && (
        <button onClick={() => setAll(!all)} className="mt-3 text-sm font-semibold text-sky-deep">
          {all ? 'Ver menos' : `Ver los ${sorted.length}`}
        </button>
      )}
    </div>
  )
}

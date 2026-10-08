import { ranking } from './points'
import type { Confirmation, GoogleBonus, PointEvent } from './points'
import type { Profile, Report, Severity } from './types'

/**
 * Métricas del panel admin. Todo se calcula en el navegador con los datos que el admin ya
 * carga (reportes, confirmaciones, bonos de Google y perfiles), igual que los puntos.
 */

export type MetricsPeriod = '7' | '30' | '90' | 'all'

const DAY = 86_400_000
const SEVERITY_WEIGHT: Record<Severity, number> = { peligroso: 3, mediano: 2, pequeno: 1 }

export const isActive = (r: Report) => r.status === 'pendiente' || r.status === 'verificado'

/** Inicio del periodo (ms) o `null` si es "todo". */
export function periodStart(period: MetricsPeriod, now = Date.now()) {
  return period === 'all' ? null : now - Number(period) * DAY
}

// Sin fecha = recién creado (aún sin serverTimestamp): cuenta como "ahora".
const time = (d: Date | null, now: number) => d?.getTime() ?? now
const within = (d: Date | null, from: number | null, now: number, to = Infinity) => {
  const t = time(d, now)
  return (from === null || t >= from) && t < to
}

function median(values: number[]) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface ReportMetrics {
  received: number
  /** Recibidos en el periodo anterior de igual duración (null si el periodo es "todo"). */
  receivedPrev: number | null
  active: number
  activeDangerous: number
  fixedInPeriod: number
  /** Reparados / reportes válidos recibidos en el periodo (0–1). */
  resolutionRate: number | null
  /** Días (mediana) entre el reporte y su reparación, de los reparados en el periodo. */
  medianRepairDays: number | null
  rejected: number
  /** Falsos / recibidos en el periodo (0–1). */
  rejectedRate: number | null
  confirmations: number
  /** Pendientes por antigüedad. */
  aging: { label: string; count: number; dangerous: number }[]
  /** Pendientes por severidad. */
  bySeverity: Record<Severity, number>
}

/** `reports` ya filtrados por ciudad; `confirmations` de cualquier ciudad (se cruzan con los reportes). */
export function reportMetrics(reports: Report[], confirmations: Confirmation[], period: MetricsPeriod, now = Date.now()): ReportMetrics {
  const from = periodStart(period, now)
  const inPeriod = reports.filter((r) => within(r.createdAt, from, now))
  const prev = from === null ? null : reports.filter((r) => within(r.createdAt, from - (now - from), now, from)).length

  const active = reports.filter(isActive)
  const fixed = reports.filter((r) => r.status === 'reparado' && within(r.updatedAt, from, now))
  const valid = inPeriod.filter((r) => r.status !== 'rechazado')
  const rejected = inPeriod.length - valid.length
  const repairDays = fixed
    .filter((r) => r.createdAt && r.updatedAt)
    .map((r) => (r.updatedAt!.getTime() - r.createdAt!.getTime()) / DAY)

  const ids = new Set(reports.map((r) => r.id))
  const confirmationsInPeriod = confirmations.filter((c) => ids.has(c.reportId) && within(c.createdAt, from, now)).length

  const age = (r: Report) => (now - time(r.createdAt, now)) / DAY
  const buckets: [string, (d: number) => boolean][] = [
    ['Menos de 7 días', (d) => d < 7],
    ['7 a 30 días', (d) => d >= 7 && d < 30],
    ['Más de 30 días', (d) => d >= 30],
  ]
  const bySeverity: Record<Severity, number> = { peligroso: 0, mediano: 0, pequeno: 0 }
  active.forEach((r) => bySeverity[r.severity]++)

  return {
    received: inPeriod.length,
    receivedPrev: prev,
    active: active.length,
    activeDangerous: bySeverity.peligroso,
    fixedInPeriod: fixed.length,
    resolutionRate: valid.length ? valid.filter((r) => r.status === 'reparado').length / valid.length : null,
    medianRepairDays: median(repairDays),
    rejected,
    rejectedRate: inPeriod.length ? rejected / inPeriod.length : null,
    confirmations: confirmationsInPeriod,
    aging: buckets.map(([label, test]) => {
      const list = active.filter((r) => test(age(r)))
      return { label, count: list.length, dangerous: list.filter((r) => r.severity === 'peligroso').length }
    }),
    bySeverity,
  }
}

export interface TrendBucket {
  start: Date
  end: Date
  created: number
  fixed: number
}

export type TrendUnit = 'day' | 'week' | 'month'

function startOf(unit: TrendUnit, d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), unit === 'month' ? 1 : d.getDate())
  if (unit === 'week') x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // lunes
  return x
}

function addUnit(unit: TrendUnit, d: Date, n = 1) {
  const x = new Date(d)
  if (unit === 'day') x.setDate(x.getDate() + n)
  else if (unit === 'week') x.setDate(x.getDate() + 7 * n)
  else x.setMonth(x.getMonth() + n)
  return x
}

/** Reportes nuevos y reparados por día, semana o mes, según el periodo. */
export function trend(reports: Report[], period: MetricsPeriod, now = Date.now()): { unit: TrendUnit; buckets: TrendBucket[] } {
  const today = new Date(now)
  let unit: TrendUnit
  let first: Date
  if (period === '7' || period === '30') {
    unit = 'day'
    first = addUnit('day', startOf('day', today), -(Number(period) - 1))
  } else if (period === '90') {
    unit = 'week'
    first = startOf('week', new Date(now - 90 * DAY))
  } else {
    const oldest = Math.min(now, ...reports.map((r) => time(r.createdAt, now)))
    unit = now - oldest > 26 * 7 * DAY ? 'month' : 'week'
    first = startOf(unit, new Date(oldest))
    // Al menos 8 barras para que la tendencia se lea aunque el proyecto sea nuevo.
    const minFirst = addUnit(unit, startOf(unit, today), -7)
    if (first > minFirst) first = minFirst
  }

  const buckets: TrendBucket[] = []
  for (let s = first; s <= today; s = addUnit(unit, s)) {
    buckets.push({ start: s, end: addUnit(unit, s), created: 0, fixed: 0 })
  }
  const find = (d: Date | null) => {
    const t = time(d, now)
    return buckets.find((b) => t >= b.start.getTime() && t < b.end.getTime())
  }
  for (const r of reports) {
    const c = find(r.createdAt)
    if (c) c.created++
    if (r.status === 'reparado') {
      const f = find(r.updatedAt)
      if (f) f.fixed++
    }
  }
  return { unit, buckets }
}

/**
 * Pendientes ordenados por prioridad: severidad × apoyo vecinal × antigüedad.
 * Un hueco peligroso, muy confirmado y viejo va primero.
 */
export function priorityQueue(reports: Report[], limit = 8, now = Date.now()) {
  const score = (r: Report) => {
    const days = (now - time(r.createdAt, now)) / DAY
    return SEVERITY_WEIGHT[r.severity] * (1 + 0.5 * r.confirmations) * (1 + days / 14)
  }
  return reports
    .filter(isActive)
    .map((r) => ({ report: r, score: score(r) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export interface Zone {
  key: string
  label: string
  count: number
  dangerous: number
  confirmations: number
  /** El más urgente de la zona, para abrirlo en el mapa. */
  top: Report
}

/** Zonas (~1 km, geohash de 6 caracteres) con más huecos pendientes. */
export function hotZones(reports: Report[], limit = 6): Zone[] {
  const groups = new Map<string, Report[]>()
  for (const r of reports.filter(isActive)) {
    const key = r.geohash.slice(0, 6)
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const top = [...list].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || b.confirmations - a.confirmations)[0]
      // Nombre de la zona: la calle que más se repite (primer tramo de la dirección).
      const streets = new Map<string, number>()
      list.forEach((r) => {
        const s = r.address?.split(',')[0]?.trim()
        if (s) streets.set(s, (streets.get(s) ?? 0) + 1)
      })
      const street = [...streets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      return {
        key,
        label: street ?? `${top.lat.toFixed(4)}, ${top.lng.toFixed(4)}`,
        count: list.length,
        dangerous: list.filter((r) => r.severity === 'peligroso').length,
        confirmations: list.reduce((s, r) => s + r.confirmations, 0),
        top,
      }
    })
    .sort((a, b) => b.count + b.dangerous - (a.count + a.dangerous) || b.confirmations - a.confirmations)
    .slice(0, limit)
}

export interface Neighbor {
  uid: string
  profile: Profile | null
  google: boolean
  /** Ciudad donde más participa (null si aún no participa). */
  cityId: string | null
  reports: number
  fixed: number
  rejected: number
  confirmationsGiven: number
  /** Acciones (reportes + confirmaciones) dentro del periodo. */
  actionsInPeriod: number
  points: number
  firstAt: Date | null
  lastAt: Date | null
}

/**
 * Vecinos conocidos: quienes reportaron, confirmaron, eligieron alias o entraron con Google.
 * Con una ciudad elegida, solo cuentan su actividad en esa ciudad (y quienes no participan
 * en ninguna quedan fuera, porque no tienen ciudad).
 */
export function neighbors(opts: {
  reports: Report[]
  confirmations: Confirmation[]
  bonuses: GoogleBonus[]
  profiles: Map<string, Profile>
  events: PointEvent[]
  cityOf: (r: Report) => string | null
  cityId: string | null
  period: MetricsPeriod
  now?: number
}): Neighbor[] {
  const { reports, confirmations, bonuses, profiles, events, cityOf, cityId, period } = opts
  const now = opts.now ?? Date.now()
  const from = periodStart(period, now)
  const byId = new Map(reports.map((r) => [r.id, r]))
  const google = new Map(bonuses.map((b) => [b.uid, b]))

  const rows = new Map<string, Neighbor & { cities: Map<string, number> }>()
  const row = (uid: string) => {
    let n = rows.get(uid)
    if (!n) {
      n = {
        uid,
        profile: profiles.get(uid) ?? null,
        google: google.has(uid),
        cityId: null,
        reports: 0,
        fixed: 0,
        rejected: 0,
        confirmationsGiven: 0,
        actionsInPeriod: 0,
        points: 0,
        firstAt: null,
        lastAt: null,
        cities: new Map(),
      }
      rows.set(uid, n)
    }
    return n
  }
  const touch = (n: Neighbor & { cities: Map<string, number> }, at: Date | null, city: string | null) => {
    const d = at ?? new Date(now)
    if (!n.firstAt || d < n.firstAt) n.firstAt = d
    if (!n.lastAt || d > n.lastAt) n.lastAt = d
    if (within(at, from, now)) n.actionsInPeriod++
    if (city) n.cities.set(city, (n.cities.get(city) ?? 0) + 1)
  }

  for (const r of reports) {
    const city = cityOf(r)
    if (cityId && city !== cityId) continue
    const n = row(r.reporterUid)
    n.reports++
    if (r.status === 'reparado') n.fixed++
    if (r.status === 'rechazado') n.rejected++
    touch(n, r.createdAt, city)
  }
  for (const c of confirmations) {
    const r = byId.get(c.reportId)
    if (!r || r.reporterUid === c.uid) continue
    const city = cityOf(r)
    if (cityId && city !== cityId) continue
    const n = row(c.uid)
    n.confirmationsGiven++
    touch(n, c.createdAt, city)
  }
  if (!cityId) {
    // Sin actividad todavía, pero con cuenta de Google o alias.
    for (const b of bonuses) {
      const n = row(b.uid)
      const d = b.createdAt ?? new Date(now)
      if (!n.firstAt || d < n.firstAt) n.firstAt = d
      if (!n.lastAt) n.lastAt = d
    }
    for (const uid of profiles.keys()) row(uid)
  }

  const points = new Map(ranking(events, profiles, { period: 'all', cityId }).map((r) => [r.uid, r.points]))
  return [...rows.values()].map(({ cities, ...n }) => ({
    ...n,
    cityId: [...cities.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    points: points.get(n.uid) ?? 0,
  }))
}

export interface NeighborMetrics {
  known: number
  activeInPeriod: number
  newInPeriod: number
  google: number
  withAlias: number
  /** Participaron 2 o más veces. */
  recurrent: number
}

export function neighborMetrics(rows: Neighbor[], period: MetricsPeriod, now = Date.now()): NeighborMetrics {
  const from = periodStart(period, now)
  return {
    known: rows.length,
    activeInPeriod: rows.filter((n) => n.actionsInPeriod > 0).length,
    newInPeriod: rows.filter((n) => n.firstAt && within(n.firstAt, from, now)).length,
    google: rows.filter((n) => n.google).length,
    withAlias: rows.filter((n) => n.profile).length,
    recurrent: rows.filter((n) => n.reports + n.confirmationsGiven >= 2).length,
  }
}

export const neighborName = (n: Pick<Neighbor, 'uid' | 'profile'>) => n.profile?.alias ?? `Anónimo · ${n.uid.slice(0, 6)}`

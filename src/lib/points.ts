import type { Profile, Report } from './types'

/**
 * Reglas de puntos. Los puntos NO se guardan: se calculan a partir de los reportes, las
 * confirmaciones y el bono de Google (`googleBonus/{uid}`), que ya están protegidos por las
 * reglas de Firestore (nadie puede editarse su puntaje).
 */
export const POINTS = {
  report: 10, // enviar un reporte
  verified: 10, // el admin lo verifica
  fixed: 10, // lo marcan como reparado
  confirmationReceived: 2, // otro vecino confirma tu reporte…
  confirmationReceivedMax: 10, // …hasta este máximo por reporte
  confirmGiven: 2, // confirmas el reporte de otra persona
  google: 10, // entras con Google por primera vez (una sola vez por cuenta)
  rejected: -20, // el admin lo marca como falso (y se pierden los demás puntos de ese reporte)
} as const

export const LEVELS = [
  { min: 0, name: 'Nuevo vecino', emoji: '🌱' },
  { min: 10, name: 'Vecino atento', emoji: '🙂' },
  { min: 100, name: 'Cazahuecos', emoji: '🔦' },
  { min: 300, name: 'Inspector de pistas', emoji: '🚧' },
  { min: 800, name: 'Huecazo de oro', emoji: '🏆' },
] as const

export type Level = (typeof LEVELS)[number]

export function levelFor(points: number) {
  const idx = LEVELS.reduce((acc, l, i) => (points >= l.min ? i : acc), 0)
  const level = LEVELS[idx]
  const next = LEVELS[idx + 1] ?? null
  const progress = next ? (points - level.min) / (next.min - level.min) : 1
  return { level, next, progress: Math.max(0, Math.min(1, progress)) }
}

export interface Confirmation {
  uid: string
  reportId: string
  createdAt: Date | null
}

/** Bono por entrar con Google (`googleBonus/{uid}`). */
export interface GoogleBonus {
  uid: string
  createdAt: Date | null
}

export type PointKind = 'report' | 'verified' | 'fixed' | 'confirmations' | 'confirmGiven' | 'rejected' | 'google'

export interface PointEvent {
  /** Estable: permite saber qué eventos ya vio la persona. */
  id: string
  uid: string
  kind: PointKind
  points: number
  /** Vacío en el bono de Google (no viene de un reporte). */
  reportId: string
  cityId: string | null
  /** Mes al que suma (fecha del reporte o de la confirmación). */
  at: Date | null
  address: string | null
}

/** Todos los eventos de puntos que se desprenden de los datos. */
export function pointEvents(reports: Report[], confirmations: Confirmation[], bonuses: GoogleBonus[] = []): PointEvent[] {
  const events: PointEvent[] = []
  const byId = new Map(reports.map((r) => [r.id, r]))

  for (const r of reports) {
    const base = { uid: r.reporterUid, reportId: r.id, cityId: r.cityId, at: r.createdAt, address: r.address }
    if (r.status === 'rechazado') {
      events.push({ ...base, id: `${r.id}:rejected`, kind: 'rejected', points: POINTS.rejected })
      continue
    }
    events.push({ ...base, id: `${r.id}:report`, kind: 'report', points: POINTS.report })
    if (r.status === 'verificado' || r.status === 'reparado') {
      events.push({ ...base, id: `${r.id}:verified`, kind: 'verified', points: POINTS.verified })
    }
    if (r.status === 'reparado') {
      events.push({ ...base, id: `${r.id}:fixed`, kind: 'fixed', points: POINTS.fixed })
    }
    const fromConfirmations = Math.min(r.confirmations * POINTS.confirmationReceived, POINTS.confirmationReceivedMax)
    if (fromConfirmations > 0) {
      // Id estable: el aviso de puntos compara cuántos puntos de este evento ya vio la persona.
      events.push({ ...base, id: `${r.id}:confirmations`, kind: 'confirmations', points: fromConfirmations })
    }
  }

  for (const c of confirmations) {
    const r = byId.get(c.reportId)
    // No cuenta confirmar tu propio reporte ni uno que resultó falso.
    if (!r || r.status === 'rechazado' || r.reporterUid === c.uid) continue
    events.push({
      id: `${c.reportId}:confirmed-by:${c.uid}`,
      uid: c.uid,
      kind: 'confirmGiven',
      points: POINTS.confirmGiven,
      reportId: r.id,
      cityId: r.cityId,
      at: c.createdAt,
      address: r.address,
    })
  }

  for (const b of bonuses) {
    events.push({ id: `google:${b.uid}`, uid: b.uid, kind: 'google', points: POINTS.google, reportId: '', cityId: null, at: b.createdAt, address: null })
  }
  return events
}

export type Period = 'month' | 'all'

export function inPeriod(at: Date | null, period: Period, now = new Date()) {
  if (period === 'all') return true
  // Sin fecha = recién creado (aún sin serverTimestamp): cuenta para este mes.
  if (!at) return true
  return at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth()
}

export interface RankingRow {
  uid: string
  points: number
  reports: number
  profile: Profile | null
}

/** Puntos por persona (solo quienes tienen alias aparecen en el ranking público). */
export function ranking(events: PointEvent[], profiles: Map<string, Profile>, opts: { period: Period; cityId?: string | null }) {
  const totals = new Map<string, RankingRow>()
  const add = (e: PointEvent) => {
    const row = totals.get(e.uid) ?? { uid: e.uid, points: 0, reports: 0, profile: profiles.get(e.uid) ?? null }
    row.points += e.points
    if (e.kind === 'report') row.reports++
    totals.set(e.uid, row)
  }
  const inScope = events.filter((e) => inPeriod(e.at, opts.period))
  for (const e of inScope) {
    if (opts.cityId && e.cityId !== opts.cityId) continue
    add(e)
  }
  // El bono de Google no tiene ciudad: en el ranking de una ciudad solo suma a quien ya participa en ella.
  if (opts.cityId) {
    for (const e of inScope) if (e.kind === 'google' && totals.has(e.uid)) add(e)
  }
  return [...totals.values()].sort((a, b) => b.points - a.points || b.reports - a.reports)
}

export function totalFor(uid: string, events: PointEvent[], period: Period = 'all') {
  return events.filter((e) => e.uid === uid && inPeriod(e.at, period)).reduce((sum, e) => sum + e.points, 0)
}

/** Texto para el aviso "ganaste puntos". */
export function describeEvent(e: PointEvent) {
  const where = e.address ? ` en ${e.address.split(',')[0]}` : ''
  switch (e.kind) {
    case 'verified':
      return `Tu reporte${where} fue verificado`
    case 'fixed':
      return `¡Repararon el hueco${where}!`
    case 'confirmations':
      return `Vecinos confirmaron tu reporte${where}`
    case 'rejected':
      return `Tu reporte${where} fue marcado como falso`
    case 'confirmGiven':
      return `Confirmaste un reporte${where}`
    case 'google':
      return 'Entraste con Google'
    default:
      return `Reportaste un hueco${where}`
  }
}

/** Campeón de un mes ya terminado en una ciudad: quien más puntos sumó ese mes (con alias). */
export interface Champion {
  cityId: string
  /** Primer día del mes. */
  month: Date
  uid: string
  points: number
  profile: Profile
}

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth()

/**
 * Campeones de cada mes terminado, por ciudad (del más antiguo al más reciente). Como los
 * puntos, se calcula: si el admin marca un reporte como falso, el campeón de ese mes se recalcula.
 */
export function monthlyChampions(events: PointEvent[], profiles: Map<string, Profile>, now = new Date()): Champion[] {
  const current = monthIndex(now)
  const byMonth = new Map<number, PointEvent[]>()
  for (const e of events) {
    // Sin fecha = recién creado: es del mes en curso, que aún no termina.
    if (!e.at) continue
    const m = monthIndex(e.at)
    if (m >= current) continue
    byMonth.set(m, [...(byMonth.get(m) ?? []), e])
  }
  const cities = [...new Set(events.map((e) => e.cityId).filter((c): c is string => !!c))]
  const champions: Champion[] = []
  for (const [m, list] of [...byMonth.entries()].sort((a, b) => a[0] - b[0])) {
    for (const cityId of cities) {
      // `period: 'all'` porque los eventos ya son solo de ese mes.
      const top = ranking(list, profiles, { period: 'all', cityId }).find((r) => r.profile && r.points > 0)
      if (top?.profile) {
        champions.push({ cityId, month: new Date(Math.floor(m / 12), m % 12, 1), uid: top.uid, points: top.points, profile: top.profile })
      }
    }
  }
  return champions
}

/** Títulos de campeón de cada persona (en cualquier ciudad). */
export function titlesByUid(champions: Champion[]) {
  const titles = new Map<string, Champion[]>()
  for (const c of champions) titles.set(c.uid, [...(titles.get(c.uid) ?? []), c])
  return titles
}

/** Resumen público de un vecino (página /vecino/:uid). */
export function neighborSummary(uid: string, reports: Report[], events: PointEvent[], profiles: Map<string, Profile>) {
  const mine = reports.filter((r) => r.reporterUid === uid && r.status !== 'rechazado')
  const myEvents = events.filter((e) => e.uid === uid)
  // Ciudad donde más participa: ahí se muestra su puesto.
  const cities = new Map<string, number>()
  myEvents.forEach((e) => e.cityId && cities.set(e.cityId, (cities.get(e.cityId) ?? 0) + 1))
  const cityId = [...cities.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const position = (period: Period) => {
    if (!cityId) return 0
    const visible = ranking(events, profiles, { period, cityId }).filter((r) => r.profile && r.points > 0)
    return visible.findIndex((r) => r.uid === uid) + 1
  }
  const dates = myEvents.map((e) => e.at?.getTime()).filter((t): t is number => t !== undefined)
  return {
    total: totalFor(uid, events),
    month: totalFor(uid, events, 'month'),
    reports: mine.length,
    fixed: mine.filter((r) => r.status === 'reparado').length,
    supportsReceived: mine.reduce((s, r) => s + r.confirmations, 0),
    confirmationsGiven: myEvents.filter((e) => e.kind === 'confirmGiven').length,
    cityId,
    positionMonth: position('month'),
    positionAll: position('all'),
    since: dates.length ? new Date(Math.min(...dates)) : null,
  }
}

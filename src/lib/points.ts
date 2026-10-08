import type { Profile, Report } from './types'

/**
 * Reglas de puntos. Los puntos NO se guardan: se calculan a partir de los reportes y las
 * confirmaciones, que ya están protegidos por las reglas de Firestore (nadie puede editarse
 * su puntaje).
 */
export const POINTS = {
  report: 10, // enviar un reporte
  verified: 10, // el admin lo verifica
  fixed: 10, // lo marcan como reparado
  confirmationReceived: 2, // otro vecino confirma tu reporte…
  confirmationReceivedMax: 10, // …hasta este máximo por reporte
  confirmGiven: 2, // confirmas un hueco de otra persona
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

export type PointKind = 'report' | 'verified' | 'fixed' | 'confirmations' | 'confirmGiven' | 'rejected'

export interface PointEvent {
  /** Estable: permite saber qué eventos ya vio la persona. */
  id: string
  uid: string
  kind: PointKind
  points: number
  reportId: string
  cityId: string | null
  /** Mes al que suma (fecha del reporte o de la confirmación). */
  at: Date | null
  address: string | null
}

/** Todos los eventos de puntos que se desprenden de los datos. */
export function pointEvents(reports: Report[], confirmations: Confirmation[]): PointEvent[] {
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
  for (const e of events) {
    if (!inPeriod(e.at, opts.period)) continue
    if (opts.cityId && e.cityId !== opts.cityId) continue
    const row = totals.get(e.uid) ?? { uid: e.uid, points: 0, reports: 0, profile: profiles.get(e.uid) ?? null }
    row.points += e.points
    if (e.kind === 'report') row.reports++
    totals.set(e.uid, row)
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
      return `Confirmaste un hueco${where}`
    default:
      return `Reportaste un hueco${where}`
  }
}

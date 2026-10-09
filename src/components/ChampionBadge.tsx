import type { Champion } from '../lib/points'

const monthName = new Intl.DateTimeFormat('es-PE', { month: 'long' })
const monthYear = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' })

/** "septiembre" (o "septiembre de 2026" si no es de este año). */
export function championMonth(c: Champion, now = new Date()) {
  return c.month.getFullYear() === now.getFullYear() ? monthName.format(c.month) : monthYear.format(c.month)
}

/** "Campeón de septiembre" o "Campeón 3 veces". */
export function championLabel(titles: Champion[]) {
  if (!titles.length) return ''
  if (titles.length === 1) return `Campeón de ${championMonth(titles[0])}`
  return `Campeón ${titles.length} veces`
}

/** Anillo dorado para el avatar de quien fue campeón de algún mes. */
export const CHAMPION_RING = 'ring-4 ring-butter shadow-[0_0_0_7px_rgba(255,211,110,0.35)]'

/** Coronita sobre el avatar (el avatar debe ser `relative`). */
export function CrownBadge({ titles, className = '' }: { titles: Champion[]; className?: string }) {
  if (!titles.length) return null
  return (
    <span
      className={`absolute -right-2.5 -top-2.5 z-[1] flex h-8 min-w-8 items-center justify-center gap-0.5 rounded-full bg-butter px-1 text-lg leading-none shadow-soft ring-2 ring-white ${className}`}
      title={championLabel(titles)}
      aria-label={championLabel(titles)}
    >
      <span aria-hidden>👑</span>
      {titles.length > 1 && <span className="font-display text-[11px] font-semibold text-ink tabular">{titles.length}</span>}
    </span>
  )
}

/** Etiqueta "👑 Campeón de septiembre" junto al nombre. */
export function ChampionChip({ titles, className = '' }: { titles: Champion[]; className?: string }) {
  if (!titles.length) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-butter-soft px-2 py-0.5 text-[11px] font-bold text-butter-deep ${className}`}>
      👑 {championLabel(titles)}
    </span>
  )
}

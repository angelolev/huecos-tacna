import { SEVERITY_META, STATUS_META } from '../lib/types'
import type { ReportStatus, Severity } from '../lib/types'

export function StatusBadge({ status }: { status: ReportStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
      style={{ color: meta.deep, background: meta.soft }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-bold"
      style={{ borderColor: meta.soft, color: meta.deep }}
    >
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  )
}

const STEPS: ReportStatus[] = ['pendiente', 'verificado', 'reparado']

/** Mini línea de tiempo: Reportado → Verificado → Reparado. */
export function StatusTrack({ status }: { status: ReportStatus }) {
  const idx = STEPS.indexOf(status)
  return (
    <div className="flex items-center gap-1.5" aria-label={`Estado: ${STATUS_META[status].label}`}>
      {STEPS.map((s, i) => {
        const reached = i <= idx
        const meta = STATUS_META[s]
        return (
          <div key={s} className="flex flex-1 flex-col gap-1">
            <span
              className="h-1.5 rounded-full transition-colors"
              style={{ background: reached ? STATUS_META[status].color : '#F0E5DA' }}
            />
            <span className={`text-[10px] font-bold ${reached ? 'text-ink-soft' : 'text-ink-faint'}`}>{meta.short}</span>
          </div>
        )
      })}
    </div>
  )
}

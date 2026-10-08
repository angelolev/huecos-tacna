import { BottomSheet } from './BottomSheet'
import { LEVELS, POINTS } from '../lib/points'

const RULES = [
  { emoji: '📸', text: 'Reportas un hueco', points: `+${POINTS.report}` },
  { emoji: '✅', text: 'El equipo verifica tu reporte', points: `+${POINTS.verified}` },
  { emoji: '🛠️', text: 'Lo reparan', points: `+${POINTS.fixed}` },
  { emoji: '🙌', text: 'Vecinos confirman tu reporte', points: `+${POINTS.confirmationReceived} c/u (máx. +${POINTS.confirmationReceivedMax})` },
  { emoji: '👀', text: 'Confirmas el reporte de otro vecino', points: `+${POINTS.confirmGiven}` },
  { emoji: '🔐', text: 'Entras con Google por primera vez', points: `+${POINTS.google}` },
  { emoji: '🚫', text: 'Tu reporte resulta falso', points: `${POINTS.rejected}` },
]

export function PointsHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} label="Cómo ganar puntos">
      <div className="space-y-5 px-5 pb-6 pt-1">
        <div>
          <p className="font-display text-2xl font-semibold">¿Cómo gano puntos?</p>
          <p className="text-sm text-ink-muted">Cada reporte real ayuda a que reparen la pista antes.</p>
        </div>
        <ul className="space-y-2">
          {RULES.map((r) => (
            <li key={r.text} className="card flex items-center gap-3 px-4 py-3">
              <span className="text-2xl" aria-hidden>
                {r.emoji}
              </span>
              <span className="flex-1 text-sm font-medium text-ink">{r.text}</span>
              <span className={`font-display font-semibold tabular ${r.points.startsWith('-') ? 'text-coral-deep' : 'text-mint-deep'}`}>
                {r.points}
              </span>
            </li>
          ))}
        </ul>
        <div>
          <p className="mb-2 font-display text-lg font-semibold">Niveles</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LEVELS.map((l) => (
              <div key={l.name} className="rounded-2xl bg-white px-3 py-2.5 shadow-card">
                <p className="text-sm font-semibold">
                  {l.emoji} {l.name}
                </p>
                <p className="text-xs text-ink-muted tabular">desde {l.min} pts</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-muted">
          Los puntos se calculan solos a partir de tus reportes y confirmaciones. Reportar huecos falsos o repetidos resta puntos.
        </p>
      </div>
    </BottomSheet>
  )
}

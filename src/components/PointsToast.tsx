import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { confetti, haptic } from '../lib/fx'
import { describeEvent } from '../lib/points'
import type { PointEvent } from '../lib/points'

// Solo avisamos lo que pasa "sin que la persona lo vea": verificaciones, reparaciones,
// confirmaciones de otros y rechazos. Reportar o confirmar ya muestran sus puntos al momento.
const NOTIFY = new Set<PointEvent['kind']>(['verified', 'fixed', 'confirmations', 'rejected'])

const storageKey = (uid: string) => `huecazo:puntos-vistos:${uid}`

function readSeen(uid: string): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeSeen(uid: string, seen: Record<string, number>) {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(seen))
  } catch {
    /* sin almacenamiento: volveremos a avisar la próxima vez */
  }
}

/** "¡Ganaste puntos!" al abrir la app, con lo que pasó desde la última visita. */
export function PointsToast({ uid, events, ready }: { uid: string | undefined; events: PointEvent[]; ready: boolean }) {
  const [news, setNews] = useState<{ text: string; points: number }[] | null>(null)
  const done = useRef(false)

  useEffect(() => {
    if (!uid || !ready || done.current) return
    done.current = true
    const mine = events.filter((e) => e.uid === uid)
    const current = Object.fromEntries(mine.map((e) => [e.id, e.points]))
    const seen = readSeen(uid)
    writeSeen(uid, current)
    // Primera vez en este dispositivo: no avisamos el historial completo.
    if (!seen) return
    const changes = mine
      .filter((e) => NOTIFY.has(e.kind) && current[e.id] !== (seen[e.id] ?? 0))
      .map((e) => ({ text: describeEvent(e), points: current[e.id] - (seen[e.id] ?? 0) }))
      .filter((c) => c.points !== 0)
    if (!changes.length) return
    setNews(changes)
    const total = changes.reduce((s, c) => s + c.points, 0)
    if (total > 0) {
      haptic([20, 60, 30])
      setTimeout(() => confetti(1600), 400)
    }
  }, [uid, ready, events])

  useEffect(() => {
    if (!news) return
    const t = setTimeout(() => setNews(null), 9000)
    return () => clearTimeout(t)
  }, [news])

  const total = news?.reduce((s, c) => s + c.points, 0) ?? 0

  return (
    <AnimatePresence>
      {news && (
        <motion.div
          initial={{ y: -80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="pointer-events-auto fixed inset-x-0 top-0 z-40 mx-auto max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
          role="status"
        >
          <div className="rounded-[28px] bg-white p-4 shadow-float ring-2 ring-butter">
            <div className="flex items-start gap-3">
              <motion.span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-butter-soft text-2xl"
                animate={{ rotate: [0, -12, 12, -6, 0] }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                {total >= 0 ? '🎉' : '😕'}
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold">
                  {total >= 0 ? `¡Ganaste ${total} puntos!` : `Perdiste ${-total} puntos`}
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
                  {news.slice(0, 3).map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex-1 truncate">{c.text}</span>
                      <b className={c.points > 0 ? 'text-mint-deep' : 'text-coral-deep'}>
                        {c.points > 0 ? '+' : ''}
                        {c.points}
                      </b>
                    </li>
                  ))}
                  {news.length > 3 && <li className="text-xs text-ink-muted">y {news.length - 3} más…</li>}
                </ul>
                <Link to="/ranking" className="mt-2 inline-block text-sm font-semibold text-coral-deep">
                  Ver ranking →
                </Link>
              </div>
              <button onClick={() => setNews(null)} className="grid h-8 w-8 place-items-center rounded-full text-ink-muted" aria-label="Cerrar aviso">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

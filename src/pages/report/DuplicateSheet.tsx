import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Hand, LoaderCircle, Users } from 'lucide-react'
import { BottomSheet } from '../../components/BottomSheet'
import { SeverityBadge, StatusBadge } from '../../components/Badges'
import { timeAgo } from '../../lib/format'
import type { Report } from '../../lib/types'
import { Lightbox } from '../../components/Lightbox'

export type NearbyReport = Report & { distance: number }

export function DuplicateSheet({
  candidates,
  onPick,
  onDismiss,
  onClose,
}: {
  candidates: NearbyReport[]
  onPick: (r: NearbyReport) => Promise<void>
  onDismiss: () => void
  onClose: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<NearbyReport | null>(null)

  return (
    <BottomSheet open={candidates.length > 0} onClose={onClose} label="Posibles duplicados">
      <div className="px-5 pb-6">
        <div className="flex items-start gap-3">
          <span className="text-4xl" aria-hidden>
            👀
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold leading-tight text-ink">¿Será el mismo hueco?</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {candidates.length === 1 ? 'Alguien ya reportó un hueco' : `Hay ${candidates.length} reportes`} muy cerca
              (a menos de 25 m). Si es el mismo, confírmalo y así sube de prioridad.
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {candidates.map((r, i) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="card flex gap-3 p-2.5"
            >
              <button
                type="button"
                onClick={() => setViewing(r)}
                className="relative h-24 w-24 shrink-0 cursor-zoom-in"
                aria-label="Ampliar fotos de este reporte"
              >
                <img src={r.photos[0]?.url} alt="" className="h-full w-full rounded-[18px] bg-cream-200 object-cover" />
                {r.photos.length > 1 && (
                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-ink">
                    +{r.photos.length - 1}
                  </span>
                )}
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={r.status} />
                  <SeverityBadge severity={r.severity} />
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">
                  a <b className="text-ink">{Math.round(r.distance)} m</b> · {timeAgo(r.createdAt)}
                  {r.confirmations > 0 && (
                    <>
                      {' '}
                      · <Users className="inline h-3 w-3" /> {r.confirmations}
                    </>
                  )}
                </p>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-coral px-4 py-2 text-sm font-bold text-ink shadow-[0_3px_0_#E86F5A] disabled:opacity-60"
                  disabled={!!busyId}
                  onClick={async () => {
                    setBusyId(r.id)
                    try {
                      await onPick(r)
                    } finally {
                      setBusyId(null)
                    }
                  }}
                >
                  {busyId === r.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                  Sí, es este
                </motion.button>
              </div>
            </motion.li>
          ))}
        </ul>

        <Lightbox
          images={(viewing?.photos ?? []).map((p, i) => ({ src: p.url, alt: `Foto ${i + 1} del reporte cercano` }))}
          startIndex={viewing ? 0 : null}
          onClose={() => setViewing(null)}
        />

        <button className="btn-soft mt-5 w-full" onClick={onDismiss} disabled={!!busyId}>
          No, es otro hueco <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </BottomSheet>
  )
}

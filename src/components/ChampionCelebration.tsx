import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { usePointsData } from '../hooks/usePoints'
import { useBackClose } from '../hooks/useBack'
import { confetti, haptic } from '../lib/fx'
import { monthlyChampions } from '../lib/points'
import type { Champion } from '../lib/points'
import type { Report } from '../lib/types'
import { championMonth } from './ChampionBadge'

const storageKey = (uid: string) => `huecazo:coronas-vistas:${uid}`
const checkedKey = (uid: string) => `huecazo:coronas-revisadas:${uid}`
const thisMonth = () => `${new Date().getFullYear()}-${new Date().getMonth() + 1}`
const titleId = (c: Champion) => `${c.cityId}:${c.month.getFullYear()}-${c.month.getMonth() + 1}`

function readSeen(uid: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeSeen(uid: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(ids))
  } catch {
    /* sin almacenamiento: volveremos a celebrar la próxima vez */
  }
}

function readChecked(uid: string) {
  try {
    return localStorage.getItem(checkedKey(uid))
  } catch {
    return null
  }
}

/**
 * "¡Fuiste el campeón de octubre!" la primera vez que la persona abre la app tras ganar.
 * Calcular campeones pide todas las confirmaciones y perfiles, así que solo se revisa una vez
 * al mes por dispositivo (los campeones solo cambian cuando termina un mes).
 */
export function ChampionCelebration({ uid, reports, ready }: { uid: string | undefined; reports: Report[]; ready: boolean }) {
  const pending = useMemo(() => !!uid && readChecked(uid) !== thisMonth(), [uid])
  if (!uid || !ready || !pending) return null
  return <ChampionCheck key={uid} uid={uid} reports={reports} />
}

function ChampionCheck({ uid, reports }: { uid: string; reports: Report[] }) {
  const { events, profiles, loading } = usePointsData(reports)
  const champions = useMemo(() => monthlyChampions(events, profiles), [events, profiles])
  const [title, setTitle] = useState<Champion | null>(null)
  const done = useRef(false)

  useEffect(() => {
    if (loading || done.current) return
    done.current = true
    try {
      localStorage.setItem(checkedKey(uid), thisMonth())
    } catch {
      /* sin almacenamiento: se revisará otra vez */
    }
    const mine = champions.filter((c) => c.uid === uid)
    const seen = readSeen(uid)
    writeSeen(uid, mine.map(titleId))
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
    // En un dispositivo nuevo solo celebramos la corona del mes pasado, no todo el historial.
    const fresh = mine.filter((c) => (seen ? !seen.includes(titleId(c)) : c.month.getTime() === lastMonth))
    const latest = fresh.at(-1)
    if (!latest) return
    setTitle(latest)
    haptic([30, 60, 30, 60, 60])
    setTimeout(() => confetti(2600), 300)
  }, [uid, loading, champions])

  const close = () => setTitle(null)
  useBackClose(!!title, close)

  return createPortal(
    <AnimatePresence>
      {title && (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center bg-ink/40 p-6 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          role="dialog"
          aria-modal
          aria-label="Fuiste el campeón del mes"
        >
          <motion.div
            className="w-full max-w-sm rounded-[32px] bg-cream-50 p-6 text-center shadow-float"
            initial={{ scale: 0.7, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-butter-soft text-6xl ring-4 ring-butter"
              animate={{ rotate: [0, -10, 10, -6, 0], scale: [1, 1.1, 1] }}
              transition={{ delay: 0.3, duration: 0.8 }}
              aria-hidden
            >
              👑
            </motion.div>
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-butter-deep">Campeón del mes</p>
            <p className="mt-1 font-display text-3xl font-semibold leading-tight">¡Fuiste el campeón de {championMonth(title)}!</p>
            <p className="mt-2 text-sm text-ink-muted">
              Sumaste <b className="text-ink">{title.points} puntos</b> y fuiste el vecino que más ayudó ese mes. Ahora tu avatar lleva la
              coronita 👑
            </p>
            <div className="mt-6 grid gap-2">
              <button className="btn-primary" onClick={close}>
                ¡Genial!
              </button>
              <Link to={`/vecino/${title.uid}`} onClick={close} className="py-2 text-sm font-semibold text-sky-deep">
                Ver mi perfil
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

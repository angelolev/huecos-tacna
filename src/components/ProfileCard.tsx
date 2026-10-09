import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChevronRight, CircleHelp, Pencil, Trophy } from 'lucide-react'
import { useCountUp } from '../hooks/useCountUp'
import type { Champion, Level } from '../lib/points'
import { CHAMPION_RING, ChampionChip, CrownBadge } from './ChampionBadge'
import type { Profile } from '../lib/types'
import { AliasSheet } from './AliasSheet'
import { PointsHelpSheet } from './PointsHelpSheet'

/** Puntos, nivel y alias de la persona (en "Mis reportes"). */
export function ProfileCard({
  profile,
  total,
  month,
  level,
  next,
  progress,
  titles,
}: {
  titles: Champion[]
  profile: Profile | null
  total: number
  month: number
  level: Level
  next: Level | null
  progress: number
}) {
  const [aliasOpen, setAliasOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const shown = useCountUp(total)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card mb-5 overflow-hidden p-0"
      aria-label="Tus puntos"
    >
      <div className="flex items-center gap-3 bg-gradient-to-br from-butter-soft via-cream-50 to-lavender-soft p-4">
        <button
          onClick={() => setAliasOpen(true)}
          className={`relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white text-4xl shadow-soft transition active:scale-95 ${
            titles.length ? CHAMPION_RING : ''
          }`}
          aria-label="Editar alias"
        >
          {profile?.emoji ?? level.emoji}
          <CrownBadge titles={titles} />
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-ink text-white">
            <Pencil className="h-3 w-3" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          {profile ? (
            <p className={`truncate font-display text-xl font-semibold ${titles.length ? 'text-butter-deep' : ''}`}>{profile.alias}</p>
          ) : (
            <button onClick={() => setAliasOpen(true)} className="font-display text-lg font-semibold text-coral-deep underline-offset-2 hover:underline">
              Elige tu alias para el ranking
            </button>
          )}
          <p className="text-sm font-semibold text-ink-soft">
            {level.emoji} {level.name}
          </p>
          <ChampionChip titles={titles} className="mt-1" />
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-semibold leading-none tabular text-ink">{shown}</p>
          <p className="text-xs font-semibold text-ink-muted">puntos</p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <div className="h-2.5 overflow-hidden rounded-full bg-cream-200">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-coral to-butter"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.2 }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            {next ? (
              <>
                Te faltan <b className="text-ink">{next.min - total} pts</b> para {next.emoji} {next.name}
              </>
            ) : (
              '¡Llegaste al nivel máximo! 🎉'
            )}
            {month > 0 && <> · <b className="text-ink">{month}</b> este mes</>}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/ranking" className="btn-soft px-3 py-2.5 text-sm">
            <Trophy className="h-4 w-4 text-butter-deep" /> Ver ranking <ChevronRight className="h-4 w-4 text-ink-faint" />
          </Link>
          <button onClick={() => setHelpOpen(true)} className="btn-soft px-3 py-2.5 text-sm">
            <CircleHelp className="h-4 w-4 text-sky-deep" /> ¿Cómo gano?
          </button>
        </div>
      </div>

      <AliasSheet open={aliasOpen} onClose={() => setAliasOpen(false)} profile={profile} />
      <PointsHelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </motion.section>
  )
}

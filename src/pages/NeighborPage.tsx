import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCities } from '../context/CitiesContext'
import { useReports } from '../hooks/useReports'
import { usePointsData } from '../hooks/usePoints'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useBack } from '../hooks/useBack'
import { CHAMPION_RING, ChampionChip, CrownBadge, championMonth } from '../components/ChampionBadge'
import { levelFor, monthlyChampions, neighborSummary } from '../lib/points'

const sinceFmt = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' })

/** Perfil público de un vecino: solo quienes eligieron alias. Nunca muestra su nombre real ni dónde reportó. */
export default function NeighborPage() {
  const { uid = '' } = useParams()
  const { user } = useAuth()
  const { cityName } = useCities()
  const { reports, loading: reportsLoading } = useReports()
  const { events, profiles, loading: pointsLoading } = usePointsData(reports)
  const loading = reportsLoading || pointsLoading

  const profile = profiles.get(uid) ?? null
  const summary = useMemo(() => neighborSummary(uid, reports, events, profiles), [uid, reports, events, profiles])
  const titles = useMemo(() => monthlyChampions(events, profiles).filter((c) => c.uid === uid), [events, profiles, uid])
  const { level, next, progress } = levelFor(summary.total)
  const isMe = user?.uid === uid

  useDocumentMeta({ title: profile ? `${profile.alias} · Vecino` : 'Vecino', path: `/vecino/${uid}`, noindex: true })

  // Volver a donde venía (p. ej. el ranking); si entró directo por enlace, al ranking.
  const back = useBack('/ranking')

  return (
    <div className="min-h-dvh bg-blobs pb-safe-4">
      <header className="sticky top-0 z-10 bg-cream-100/80 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button onClick={back} className="icon-btn" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-2xl font-semibold text-ink">Vecino</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-10 pt-2">
        {loading ? (
          <div className="grid place-items-center py-24">
            <LoaderCircle className="h-7 w-7 animate-spin text-coral" />
          </div>
        ) : !profile ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-6xl" aria-hidden>
              🙈
            </span>
            <p className="mt-4 font-display text-2xl font-semibold">Perfil no disponible</p>
            <p className="mt-2 max-w-xs text-sm text-ink-muted">Este vecino no tiene un alias público o salió del ranking.</p>
            <Link to="/ranking" className="btn-primary mt-6">
              Ver ranking
            </Link>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Tarjeta principal */}
            <section className="card overflow-hidden p-0">
              <div className="flex flex-col items-center bg-gradient-to-br from-butter-soft via-cream-50 to-lavender-soft px-5 pb-5 pt-7 text-center">
                <span className={`relative grid h-24 w-24 place-items-center rounded-full bg-white text-6xl shadow-soft ${titles.length ? CHAMPION_RING : ''}`}>
                  {profile.emoji}
                  <CrownBadge titles={titles} className="-right-1 -top-1 h-9 min-w-9 text-xl" />
                </span>
                <p className={`mt-4 font-display text-3xl font-semibold ${titles.length ? 'text-butter-deep' : 'text-ink'}`}>{profile.alias}</p>
                <p className="mt-1 text-sm font-semibold text-ink-soft">
                  {level.emoji} {level.name}
                  {isMe && <span className="text-ink-muted"> · eres tú</span>}
                </p>
                <ChampionChip titles={titles} className="mt-2" />
              </div>
              <div className="space-y-1.5 p-4">
                <div className="flex items-baseline justify-between">
                  <p className="font-display text-3xl font-semibold tabular">
                    {summary.total} <span className="text-base text-ink-muted">pts</span>
                  </p>
                  <p className="text-sm text-ink-muted">
                    <b className="text-ink tabular">{summary.month}</b> este mes
                  </p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-cream-200">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-coral to-butter"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(progress * 100)}%` }}
                    transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.2 }}
                  />
                </div>
                <p className="text-xs text-ink-muted">
                  {next ? `A ${next.min - summary.total} pts de ${next.emoji} ${next.name}` : '¡Nivel máximo! 🎉'}
                </p>
              </div>
            </section>

            {/* Números */}
            <div className="grid grid-cols-2 gap-2.5">
              <Stat emoji="📸" value={summary.reports} label={summary.reports === 1 ? 'hueco reportado' : 'huecos reportados'} tone="bg-coral-soft" />
              <Stat emoji="🛠️" value={summary.fixed} label={summary.fixed === 1 ? 'reparado' : 'reparados'} tone="bg-mint-soft" />
              <Stat emoji="🙌" value={summary.supportsReceived} label="apoyos recibidos" tone="bg-lavender-soft" />
              <Stat emoji="👀" value={summary.confirmationsGiven} label="reportes confirmados" tone="bg-sky-soft" />
            </div>

            {/* Puesto */}
            {summary.cityId && (summary.positionMonth > 0 || summary.positionAll > 0) && (
              <section className="card flex items-center gap-3 px-4 py-3.5">
                <span className="text-3xl" aria-hidden>
                  🏆
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-ink">Ranking de {cityName(summary.cityId)}</p>
                  <p className="text-ink-muted">
                    {summary.positionMonth > 0 ? (
                      <>
                        Puesto <b className="text-ink">#{summary.positionMonth}</b> este mes
                      </>
                    ) : (
                      'Aún sin puntos este mes'
                    )}
                    {summary.positionAll > 0 && (
                      <>
                        {' '}
                        · <b className="text-ink">#{summary.positionAll}</b> histórico
                      </>
                    )}
                  </p>
                </div>
              </section>
            )}

            {/* Coronas */}
            {titles.length > 0 && (
              <section className="card px-4 py-4">
                <p className="mb-2.5 font-display text-lg font-semibold">
                  👑 {titles.length === 1 ? 'Campeón 1 vez' : `Campeón ${titles.length} veces`}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {[...titles].reverse().map((c) => (
                    <li key={`${c.cityId}-${c.month.getTime()}`} className="rounded-full bg-butter-soft px-3 py-1 text-sm font-semibold text-butter-deep first-letter:uppercase">
                      {championMonth(c)} · {c.points} pts
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {summary.since && (
              <p className="text-center text-xs text-ink-muted">Vecino desde {sinceFmt.format(summary.since)}</p>
            )}
            {isMe && (
              <Link to="/mis-reportes" className="btn-soft w-full">
                Ver mis reportes
              </Link>
            )}
          </motion.div>
        )}
      </main>
    </div>
  )
}

function Stat({ emoji, value, label, tone }: { emoji: string; value: number; label: string; tone: string }) {
  return (
    <div className={`rounded-[24px] px-4 py-3.5 ${tone}`}>
      <p className="text-xl" aria-hidden>
        {emoji}
      </p>
      <p className="mt-1 font-display text-3xl font-semibold leading-none text-ink tabular">{value}</p>
      <p className="mt-1 text-xs font-semibold text-ink-soft">{label}</p>
    </div>
  )
}

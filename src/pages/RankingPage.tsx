import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, CircleHelp, Crown, LoaderCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCities } from '../context/CitiesContext'
import { useReports } from '../hooks/useReports'
import { usePointsData } from '../hooks/usePoints'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { AliasSheet } from '../components/AliasSheet'
import { PointsHelpSheet } from '../components/PointsHelpSheet'
import { levelFor, ranking, totalFor } from '../lib/points'
import type { Period, RankingRow } from '../lib/points'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'Este mes' },
  { id: 'all', label: 'Histórico' },
]

const MONTH = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(new Date())

export default function RankingPage() {
  const { user } = useAuth()
  const { reports, loading: reportsLoading } = useReports()
  const { events, profiles, loading: pointsLoading } = usePointsData(reports)
  const { cities, enabledCities, defaultCity } = useCities()
  const [period, setPeriod] = useState<Period>('month')
  const [cityId, setCityId] = useState<string>(defaultCity.id)
  const [aliasOpen, setAliasOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const loading = reportsLoading || pointsLoading

  useDocumentMeta({
    title: 'Ranking de vecinos',
    description: 'Los vecinos que más huecos reportan y confirman en su ciudad. Gana puntos con cada reporte y sube de nivel en Huecazo.',
    path: '/ranking',
  })

  // Ciudades con actividad (o activas), para el selector.
  const cityOptions = useMemo(() => {
    const withReports = new Set(reports.map((r) => r.cityId))
    return cities.filter((c) => c.enabled || withReports.has(c.id))
  }, [cities, reports])

  const all = useMemo(() => ranking(events, profiles, { period, cityId }), [events, profiles, period, cityId])
  // El nivel siempre se basa en los puntos de siempre (todas las ciudades).
  const lifetime = useMemo(
    () => new Map(ranking(events, profiles, { period: 'all' }).map((r) => [r.uid, r.points])),
    [events, profiles],
  )
  // Solo aparecen quienes eligieron alias y tienen puntos positivos.
  const visible = all.filter((r) => r.profile && r.points > 0)
  const podium = visible.slice(0, 3)
  const rest = visible.slice(3, 50)

  const me = user ? all.find((r) => r.uid === user.uid) : undefined
  const myPosition = me?.profile ? visible.findIndex((r) => r.uid === me.uid) + 1 : 0
  const myProfile = user ? (profiles.get(user.uid) ?? null) : null
  const myTotal = user ? totalFor(user.uid, events) : 0

  return (
    <div className="min-h-dvh bg-blobs pb-40">
      <header className="sticky top-0 z-10 bg-cream-100/80 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link to="/" className="icon-btn" aria-label="Volver al mapa">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 font-display text-2xl font-semibold">Ranking 🏆</h1>
          <button onClick={() => setHelpOpen(true)} className="icon-btn" aria-label="¿Cómo gano puntos?">
            <CircleHelp className="h-5 w-5 text-sky-deep" />
          </button>
        </div>
        <div className="mx-auto flex max-w-lg flex-wrap items-center gap-2 px-4 pb-3">
          <div className="flex gap-1 rounded-full bg-white p-1 shadow-soft" role="tablist" aria-label="Periodo">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={`relative rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${period === p.id ? 'text-ink' : 'text-ink-muted'}`}
              >
                {period === p.id && (
                  <motion.span layoutId="period-pill" className="absolute inset-0 rounded-full bg-butter-soft ring-2 ring-butter" />
                )}
                <span className="relative">{p.label}</span>
              </button>
            ))}
          </div>
          {cityOptions.length > 1 && (
            <select value={cityId} onChange={(e) => setCityId(e.target.value)} className="field w-auto py-1.5 text-sm font-semibold" aria-label="Ciudad">
              {cityOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4">
        <p className="mb-4 text-center text-sm text-ink-muted">
          {period === 'month' ? `Puntos de ${MONTH}` : 'Puntos de siempre'} en{' '}
          {cityOptions.find((c) => c.id === cityId)?.name ?? enabledCities[0]?.name ?? 'tu ciudad'}
        </p>

        {loading ? (
          <div className="grid place-items-center py-20">
            <LoaderCircle className="h-7 w-7 animate-spin text-coral" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <span className="animate-floaty text-6xl" aria-hidden>
              🏆
            </span>
            <p className="mt-4 font-display text-2xl font-semibold">¡El podio está libre!</p>
            <p className="mt-2 max-w-xs text-sm text-ink-muted">Reporta un hueco y elige tu alias para ser el primero del ranking.</p>
            <Link to="/reportar" className="btn-primary mt-6">
              Reportar un hueco
            </Link>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={`${period}-${cityId}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Podium rows={podium} myUid={user?.uid} />
              {rest.length > 0 && (
                <ol className="mt-6 space-y-2" start={4}>
                  {rest.map((r, i) => (
                    <Row key={r.uid} row={r} position={i + 4} mine={r.uid === user?.uid} lifetime={lifetime.get(r.uid) ?? r.points} />
                  ))}
                </ol>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Tu lugar */}
      <div className="fixed inset-x-0 bottom-0 z-20 pb-safe">
        <div className="mx-auto max-w-lg px-4 pb-4">
          <div className="flex items-center gap-3 rounded-[28px] bg-ink px-4 py-3 text-white shadow-float">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-2xl">
              {myProfile?.emoji ?? levelFor(myTotal).level.emoji}
            </span>
            <div className="min-w-0 flex-1">
              {myProfile ? (
                <>
                  <p className="truncate font-semibold">{myProfile.alias}</p>
                  <p className="text-xs text-white/70">
                    {myPosition ? `Puesto #${myPosition}` : 'Aún sin puntos en este periodo'} · {me?.points ?? 0} pts
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Tienes {me?.points ?? 0} pts</p>
                  <p className="text-xs text-white/70">Elige un alias para aparecer en el ranking</p>
                </>
              )}
            </div>
            <button onClick={() => setAliasOpen(true)} className="shrink-0 rounded-full bg-coral px-4 py-2 text-sm font-bold text-ink transition active:scale-95">
              {myProfile ? 'Editar' : 'Elegir alias'}
            </button>
          </div>
        </div>
      </div>

      <AliasSheet open={aliasOpen} onClose={() => setAliasOpen(false)} profile={myProfile} />
      <PointsHelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

const PODIUM_STYLE = [
  { h: 'h-32', bg: 'bg-butter', medal: '🥇', delay: 0.15 },
  { h: 'h-24', bg: 'bg-lavender', medal: '🥈', delay: 0.05 },
  { h: 'h-20', bg: 'bg-coral', medal: '🥉', delay: 0.25 },
]

function Podium({ rows, myUid }: { rows: RankingRow[]; myUid?: string }) {
  // Orden visual: 2.º, 1.º, 3.º
  const order = [1, 0, 2].filter((i) => rows[i])
  return (
    <div className="flex items-end justify-center gap-3 pt-6">
      {order.map((i) => {
        const r = rows[i]
        const st = PODIUM_STYLE[i]
        return (
          <motion.div
            key={r.uid}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18, delay: st.delay }}
            className="flex w-28 flex-col items-center"
          >
            <div className="relative">
              {i === 0 && <Crown className="absolute -top-6 left-1/2 h-6 w-6 -translate-x-1/2 text-butter-deep" fill="#FFD36E" />}
              <span
                className={`grid h-16 w-16 place-items-center rounded-full bg-white text-4xl shadow-soft ${r.uid === myUid ? 'ring-4 ring-coral' : ''}`}
              >
                {r.profile?.emoji}
              </span>
            </div>
            <p className="mt-2 w-full truncate text-center text-sm font-semibold">{r.profile?.alias}</p>
            <p className="text-xs text-ink-muted tabular">{r.points} pts</p>
            <div className={`mt-2 flex w-full ${st.h} items-start justify-center rounded-t-2xl ${st.bg} pt-2 text-2xl shadow-card`}>{st.medal}</div>
          </motion.div>
        )
      })}
    </div>
  )
}

function Row({ row, position, mine, lifetime }: { row: RankingRow; position: number; mine: boolean; lifetime: number }) {
  const { level } = levelFor(lifetime)
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(position - 4, 10) * 0.03 }}
      className={`card flex items-center gap-3 px-4 py-3 ${mine ? 'ring-2 ring-coral' : ''}`}
    >
      <span className="w-6 text-center font-display font-semibold tabular text-ink-muted">{position}</span>
      <span className="text-2xl" aria-hidden>
        {row.profile?.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{row.profile?.alias}</p>
        <p className="text-xs text-ink-muted">
          {level.emoji} {level.name} · {row.reports} {row.reports === 1 ? 'reporte' : 'reportes'}
        </p>
      </div>
      <span className="font-display text-lg font-semibold tabular">{row.points}</span>
    </motion.li>
  )
}


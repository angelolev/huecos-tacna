import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, CircleHelp, LoaderCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCities } from '../context/CitiesContext'
import { useReports } from '../hooks/useReports'
import { usePointsData } from '../hooks/usePoints'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useBack } from '../hooks/useBack'
import { AliasSheet } from '../components/AliasSheet'
import { PointsHelpSheet } from '../components/PointsHelpSheet'
import { CHAMPION_RING, ChampionChip, CrownBadge, championMonth } from '../components/ChampionBadge'
import { levelFor, monthlyChampions, ranking, titlesByUid, totalFor } from '../lib/points'
import type { Champion, Period, RankingRow } from '../lib/points'

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
  const back = useBack()

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

  // Campeones de cada mes terminado (la coronita vale en cualquier ciudad).
  const champions = useMemo(() => monthlyChampions(events, profiles), [events, profiles])
  const titles = useMemo(() => titlesByUid(champions), [champions])
  const titlesOf = (uid: string) => titles.get(uid) ?? []
  const cityChampions = champions.filter((c) => c.cityId === cityId)
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const reigning = cityChampions.find((c) => c.month.getTime() === lastMonth.getTime()) ?? null

  return (
    <div className="min-h-dvh bg-blobs pb-40">
      <header className="sticky top-0 z-10 bg-cream-100/80 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button onClick={back} className="icon-btn" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </button>
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
              {reigning && period === 'month' && <ReigningChampion champion={reigning} titles={titlesOf(reigning.uid)} />}
              <Podium rows={podium} myUid={user?.uid} titlesOf={titlesOf} />
              {rest.length > 0 && (
                <ol className="mt-6 space-y-2" start={4}>
                  {rest.map((r, i) => (
                    <Row
                      key={r.uid}
                      row={r}
                      position={i + 4}
                      mine={r.uid === user?.uid}
                      lifetime={lifetime.get(r.uid) ?? r.points}
                      titles={titlesOf(r.uid)}
                    />
                  ))}
                </ol>
              )}
              {period === 'all' && cityChampions.length > 0 && <HallOfFame champions={cityChampions} myUid={user?.uid} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Tu lugar */}
      <div className="fixed inset-x-0 bottom-0 z-20 pb-safe">
        <div className="mx-auto max-w-lg px-4 pb-4">
          <div className="flex items-center gap-3 rounded-[28px] bg-ink px-4 py-3 text-white shadow-float">
            <span
              className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-2xl ${
                user && titlesOf(user.uid).length ? 'ring-2 ring-butter' : ''
              }`}
            >
              {myProfile?.emoji ?? levelFor(myTotal).level.emoji}
              {user && <CrownBadge titles={titlesOf(user.uid)} className="ring-ink" />}
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

const MotionLink = motion.create(Link)

const PODIUM_STYLE = [
  { h: 'h-32', bg: 'bg-butter', medal: '🥇', delay: 0.15 },
  { h: 'h-24', bg: 'bg-lavender', medal: '🥈', delay: 0.05 },
  { h: 'h-20', bg: 'bg-coral', medal: '🥉', delay: 0.25 },
]

function Podium({ rows, myUid, titlesOf }: { rows: RankingRow[]; myUid?: string; titlesOf: (uid: string) => Champion[] }) {
  // Orden visual: 2.º, 1.º, 3.º
  const order = [1, 0, 2].filter((i) => rows[i])
  return (
    <div className="flex items-end justify-center gap-3 pt-6">
      {order.map((i) => {
        const r = rows[i]
        const st = PODIUM_STYLE[i]
        const titles = titlesOf(r.uid)
        return (
          <MotionLink
            key={r.uid}
            to={`/vecino/${r.uid}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18, delay: st.delay }}
            className="flex w-28 flex-col items-center transition-transform active:scale-95"
            aria-label={`Ver perfil de ${r.profile?.alias}`}
          >
            <div className="relative">
              <span
                className={`grid h-16 w-16 place-items-center rounded-full bg-white text-4xl shadow-soft ${
                  titles.length ? CHAMPION_RING : r.uid === myUid ? 'ring-4 ring-coral' : ''
                }`}
              >
                {r.profile?.emoji}
              </span>
              <CrownBadge titles={titles} />
            </div>
            <p className={`mt-2 w-full truncate text-center text-sm font-semibold ${titles.length ? 'text-butter-deep' : ''}`}>
              {r.profile?.alias}
            </p>
            <p className="text-xs text-ink-muted tabular">{r.points} pts</p>
            <div className={`mt-2 flex w-full ${st.h} items-start justify-center rounded-t-2xl ${st.bg} pt-2 text-2xl shadow-card`}>{st.medal}</div>
          </MotionLink>
        )
      })}
    </div>
  )
}

function Row({
  row,
  position,
  mine,
  lifetime,
  titles,
}: {
  row: RankingRow
  position: number
  mine: boolean
  lifetime: number
  titles: Champion[]
}) {
  const { level } = levelFor(lifetime)
  return (
    <motion.li initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(position - 4, 10) * 0.03 }}>
      <Link
        to={`/vecino/${row.uid}`}
        className={`card flex items-center gap-3 px-4 py-3 transition active:scale-[0.98] ${mine ? 'ring-2 ring-coral' : ''}`}
      >
      <span className="w-6 text-center font-display font-semibold tabular text-ink-muted">{position}</span>
      <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream-100 text-2xl ${titles.length ? CHAMPION_RING : ''}`} aria-hidden>
        {row.profile?.emoji}
        <CrownBadge titles={titles} className="-right-2.5 -top-2.5 h-6 min-w-6 text-sm" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold ${titles.length ? 'text-butter-deep' : ''}`}>{row.profile?.alias}</p>
        {titles.length ? (
          <ChampionChip titles={titles} />
        ) : (
          <p className="text-xs text-ink-muted">
            {level.emoji} {level.name} · {row.reports} {row.reports === 1 ? 'reporte' : 'reportes'}
          </p>
        )}
      </div>
      <span className="font-display text-lg font-semibold tabular">{row.points}</span>
      </Link>
    </motion.li>
  )
}

/** "Campeón de septiembre" arriba del ranking del mes en curso. */
function ReigningChampion({ champion, titles }: { champion: Champion; titles: Champion[] }) {
  return (
    <MotionLink
      to={`/vecino/${champion.uid}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-2 flex items-center gap-3 rounded-[24px] bg-gradient-to-r from-butter-soft via-cream-50 to-butter-soft p-3 ring-2 ring-butter"
    >
      <span className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-3xl ${CHAMPION_RING}`}>
        {champion.profile.emoji}
        <CrownBadge titles={titles} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-butter-deep">Campeón de {championMonth(champion)}</p>
        <p className="truncate font-display text-lg font-semibold">{champion.profile.alias}</p>
      </div>
      <p className="shrink-0 text-right">
        <span className="block font-display text-xl font-semibold tabular">{champion.points}</span>
        <span className="text-[11px] text-ink-muted">pts</span>
      </p>
    </MotionLink>
  )
}

/** Campeones de cada mes en la ciudad, del más reciente al más antiguo. */
function HallOfFame({ champions, myUid }: { champions: Champion[]; myUid?: string }) {
  return (
    <section className="mt-8">
      <p className="mb-2 font-display text-xl font-semibold">👑 Campeones de cada mes</p>
      <ol className="space-y-2">
        {[...champions].reverse().map((c) => (
          <li key={c.month.getTime()}>
            <Link to={`/vecino/${c.uid}`} className={`card flex items-center gap-3 px-4 py-3 ${c.uid === myUid ? 'ring-2 ring-coral' : ''}`}>
            <span className="text-2xl" aria-hidden>
              {c.profile.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.profile.alias}</p>
              <p className="text-xs capitalize text-ink-muted">{championMonth(c)}</p>
            </div>
            <span className="font-display text-lg font-semibold tabular">{c.points}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Camera, LoaderCircle, MapPin, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useMyReports } from '../hooks/useReports'
import { useCountUp } from '../hooks/useCountUp'
import { SeverityBadge, StatusTrack } from '../components/Badges'
import { GoogleButton } from '../components/GoogleButton'
import { timeAgo } from '../lib/format'
import { authErrorMessage } from '../lib/authErrors'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

export default function MyReportsPage() {
  const { user, linkGoogle } = useAuth()
  const { reports, loading } = useMyReports(user?.uid)
  useDocumentMeta({ title: 'Mis reportes', path: '/mis-reportes', noindex: true })
  const [linking, setLinking] = useState(false)
  const [linkMsg, setLinkMsg] = useState<string | null>(null)

  const fixed = reports.filter((r) => r.status === 'reparado').length
  const confirmations = reports.reduce((sum, r) => sum + r.confirmations, 0)

  return (
    <div className="min-h-dvh bg-blobs pb-safe-4">
      <header className="sticky top-0 z-10 pt-safe">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link to="/" className="icon-btn" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-2xl font-semibold text-ink">Mis reportes</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-2">
        {!loading && reports.length > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-2.5">
            <Stat value={reports.length} label="reportados" tone="bg-coral-soft text-coral-deep" emoji="📸" i={0} />
            <Stat value={fixed} label="reparados" tone="bg-mint-soft text-mint-deep" emoji="🛠️" i={1} />
            <Stat value={confirmations} label="apoyos" tone="bg-lavender-soft text-lavender-deep" emoji="🙌" i={2} />
          </div>
        )}

        {user?.isAnonymous && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 rounded-[24px] bg-sky-soft p-4">
            <p className="mb-3 text-sm text-ink-soft">
              Tus reportes están guardados <b className="text-ink">solo en este celular</b>. Vincula tu Google para no perderlos.
            </p>
            <GoogleButton
              label={linking ? 'Conectando…' : 'Vincular con Google'}
              disabled={linking}
              onClick={async () => {
                setLinking(true)
                setLinkMsg(null)
                try {
                  const r = await linkGoogle()
                  if (r === 'switched') setLinkMsg('Esa cuenta ya existía: ahora ves los reportes guardados en ella.')
                } catch (err) {
                  setLinkMsg(authErrorMessage(err))
                } finally {
                  setLinking(false)
                }
              }}
            />
          </motion.div>
        )}
        {linkMsg && <p className="mb-4 rounded-2xl bg-mint-soft px-4 py-3 text-sm text-mint-deep">{linkMsg}</p>}

        {loading ? (
          <div className="grid place-items-center py-20">
            <LoaderCircle className="h-7 w-7 animate-spin text-coral" />
          </div>
        ) : reports.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-14 text-center">
            <span className="animate-floaty text-6xl" aria-hidden>
              🛣️
            </span>
            <p className="mt-4 font-display text-2xl font-semibold text-ink">Aún no has reportado</p>
            <p className="mt-2 max-w-xs text-sm text-ink-muted">¿Viste un hueco en el camino? Repórtalo en 30 segundos.</p>
            <Link to="/reportar" className="btn-primary mt-6">
              <Camera className="h-5 w-5" /> Reportar un hueco
            </Link>
          </motion.div>
        ) : (
          <ul className="space-y-3">
            {reports.map((r, i) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link to={`/?r=${r.id}`} className="card flex gap-3 p-3">
                  <img src={r.photos[0]?.url} alt="" className="h-[92px] w-[92px] shrink-0 rounded-[18px] bg-cream-200 object-cover" loading="lazy" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <p className="flex min-w-0 flex-1 items-center gap-1 text-sm font-semibold text-ink">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-coral-deep" />
                        <span className="truncate">{r.address ?? 'Punto en el mapa'}</span>
                      </p>
                      <SeverityBadge severity={r.severity} />
                    </div>
                    <StatusTrack status={r.status} />
                    <p className="flex items-center gap-2 text-xs text-ink-muted">
                      {timeAgo(r.createdAt)}
                      {r.confirmations > 0 && (
                        <span className="flex items-center gap-1">
                          · <Users className="h-3 w-3" /> {r.confirmations} {r.confirmations === 1 ? 'vecino' : 'vecinos'} lo confirman
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function Stat({ value, label, tone, emoji, i }: { value: number; label: string; tone: string; emoji: string; i: number }) {
  const n = useCountUp(value)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: i * 0.07, type: 'spring', stiffness: 300, damping: 20 }}
      className={`rounded-[22px] px-3 py-3 ${tone}`}
    >
      <p className="text-lg leading-none" aria-hidden>
        {emoji}
      </p>
      <p className="mt-1.5 font-display text-3xl font-semibold leading-none tabular">{n}</p>
      <p className="mt-1 text-xs font-semibold opacity-80">{label}</p>
    </motion.div>
  )
}

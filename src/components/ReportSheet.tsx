import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Hand, MapPin, PartyPopper } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { confirmReport, hasConfirmed } from '../lib/reports'
import { ensureProfile } from '../lib/profiles'
import { trackEvent } from '../lib/analytics'
import { haptic } from '../lib/fx'
import { CONFIRM_RADIUS_M, getCurrentPosition, metersBetween, nearEnoughToConfirm } from '../lib/geo'
import { POINTS } from '../lib/points'
import type { Report } from '../lib/types'
import { BottomSheet } from './BottomSheet'
import { ReportDetail } from './ReportDetail'

export function ReportSheet({ report, onClose }: { report: Report | null; onClose: () => void }) {
  return (
    <BottomSheet open={!!report} onClose={onClose} label="Detalle del reporte" backCloses={false}>
      {report && <ReportDetail report={report} actions={<ConfirmButton report={report} />} />}
    </BottomSheet>
  )
}

function ConfirmButton({ report }: { report: Report }) {
  const { user } = useAuth()
  const [state, setState] = useState<'checking' | 'can' | 'locating' | 'far' | 'nogps' | 'done' | 'sending' | 'error'>('checking')
  const [distance, setDistance] = useState<number | null>(null)
  const isMine = user?.uid === report.reporterUid

  useEffect(() => {
    if (!user || isMine) return
    let cancelled = false
    setState('checking')
    hasConfirmed(report.id, user.uid)
      .then((yes) => !cancelled && setState(yes ? 'done' : 'can'))
      .catch(() => !cancelled && setState('can'))
    return () => {
      cancelled = true
    }
  }, [report.id, user, isMine])

  if (report.status === 'reparado') {
    return <p className="rounded-2xl bg-mint-soft py-3 text-center text-sm font-semibold text-mint-deep">¡Este hueco ya fue reparado! 🎉</p>
  }
  if (isMine) {
    return <p className="py-1 text-center text-sm text-ink-muted">Este reporte lo hiciste tú. ¡Gracias! 💛</p>
  }
  if (state === 'done') {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className="flex items-center justify-center gap-2 rounded-full bg-mint-soft py-3.5 font-display font-medium text-mint-deep"
      >
        <PartyPopper className="h-5 w-5" /> ¡Gracias por confirmar! +{POINTS.confirmGiven} pts
      </motion.div>
    )
  }

  const onConfirm = async () => {
    if (!user) return
    haptic()
    // Solo puede confirmar quien está (o estuvo hace un momento) junto al hueco.
    setState('locating')
    let here: Awaited<ReturnType<typeof getCurrentPosition>>
    try {
      here = await getCurrentPosition(30000)
    } catch {
      setState('nogps')
      return
    }
    if (!nearEnoughToConfirm(here, report)) {
      setDistance(metersBetween(here, report))
      setState('far')
      return
    }
    setState('sending')
    try {
      await confirmReport(report.id, user.uid, here)
      trackEvent('report_confirmed', { source: 'mapa' })
      haptic([10, 40, 20])
      setState('done')
      ensureProfile(user.uid).catch((e) => console.error('No se pudo asignar el alias', e))
    } catch (err) {
      console.error(err)
      setState('error')
    }
  }

  return (
    <>
      <button className="btn-primary" onClick={onConfirm} disabled={state === 'checking' || state === 'locating' || state === 'sending'}>
        <Hand className="h-5 w-5" />
        {state === 'locating' ? 'Verificando tu ubicación…' : state === 'sending' ? 'Enviando…' : 'Yo también lo vi'}
      </button>
      {state === 'can' && (
        <p className="flex items-center justify-center gap-1 text-center text-xs text-ink-muted">
          <MapPin className="h-3.5 w-3.5" /> Para confirmar tienes que estar a menos de {CONFIRM_RADIUS_M} m del hueco
        </p>
      )}
      {state === 'far' && distance !== null && (
        <p className="text-center text-xs text-coral-deep">
          Estás a {formatDistance(distance)} del hueco. Acércate a menos de {CONFIRM_RADIUS_M} m para confirmarlo.
        </p>
      )}
      {state === 'nogps' && (
        <p className="text-center text-xs text-coral-deep">Activa tu ubicación para confirmar que estás junto al hueco.</p>
      )}
      {state === 'error' && <p className="text-center text-xs text-coral-deep">No se pudo confirmar. Intenta de nuevo.</p>}
    </>
  )
}

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Hand, PartyPopper } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { confirmReport, hasConfirmed } from '../lib/reports'
import { ensureProfile } from '../lib/profiles'
import { trackEvent } from '../lib/analytics'
import { haptic } from '../lib/fx'
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
  const [state, setState] = useState<'checking' | 'can' | 'done' | 'sending' | 'error'>('checking')
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
    setState('sending')
    try {
      await confirmReport(report.id, user.uid)
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
      <button className="btn-primary" onClick={onConfirm} disabled={state === 'checking' || state === 'sending'}>
        <Hand className="h-5 w-5" />
        {state === 'sending' ? 'Enviando…' : 'Yo también lo vi'}
      </button>
      {state === 'error' && <p className="text-center text-xs text-coral-deep">No se pudo confirmar. Intenta de nuevo.</p>}
    </>
  )
}

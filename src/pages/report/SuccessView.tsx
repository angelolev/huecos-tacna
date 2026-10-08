import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, MapPinned, Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { GoogleButton } from '../../components/GoogleButton'
import { confetti, haptic } from '../../lib/fx'
import { ShareButton } from '../../components/ShareButton'
import { POINTS } from '../../lib/points'
import type { Severity } from '../../lib/types'
import { authErrorMessage } from '../../lib/authErrors'

export function SuccessView({
  report,
  kind,
  onAnother,
}: {
  report: { id: string; address: string | null; severity: Severity }
  kind: 'created' | 'confirmed'
  onAnother: () => void
}) {
  const { user, linkGoogle } = useAuth()
  const [linkState, setLinkState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    haptic([20, 60, 30])
    const t = setTimeout(() => confetti(), 250)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-6 pb-6 pt-12 text-center">
      <div className="relative grid h-40 w-40 place-items-center">
        <span className="absolute inset-4 rounded-full bg-mint/40 animate-halo" />
        <motion.span
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          className="absolute inset-6 rounded-full border-[6px] border-white bg-mint shadow-float"
        />
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.25 }}
          className="relative"
        >
          <Check className="h-16 w-16 text-ink" strokeWidth={3} />
        </motion.span>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="title mt-6"
      >
        {kind === 'created' ? '¡Gracias, vecino! 🎉' : '¡Gracias por confirmar! 🙌'}
      </motion.h1>
      <motion.span
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.55, type: 'spring', stiffness: 400, damping: 12 }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-butter-soft px-4 py-1.5 font-display text-lg font-semibold text-butter-deep"
      >
        ⭐ +{kind === 'created' ? POINTS.report : POINTS.confirmGiven} puntos
      </motion.span>
      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mt-3 max-w-xs text-ink-muted"
      >
        {kind === 'created'
          ? 'Tu reporte ya aparece en el mapa. Cada reporte ayuda a que lo reparen antes.'
          : 'Sumaste tu voz a un reporte que ya existía. Mientras más vecinos lo confirman, más prioridad tiene.'}
      </motion.p>

      {user?.isAnonymous && linkState !== 'done' && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 w-full rounded-[24px] bg-sky-soft p-4 text-left"
        >
          <p className="mb-3 text-sm text-ink-soft">
            ¿Quieres ver tus reportes desde cualquier celular? <b className="text-ink">Vincula tu Google</b> y gana{' '}
            <b className="text-ink">+{POINTS.google} puntos</b> (es opcional).
          </p>
          <GoogleButton
            label={linkState === 'busy' ? 'Conectando…' : 'Vincular con Google'}
            disabled={linkState === 'busy'}
            onClick={async () => {
              setLinkState('busy')
              try {
                await linkGoogle()
                setLinkState('done')
              } catch (err) {
                setLinkError(authErrorMessage(err))
                setLinkState('error')
              }
            }}
          />
          {linkState === 'error' && <p className="mt-2 text-xs text-coral-deep">{linkError}</p>}
        </motion.div>
      )}
      {linkState === 'done' && (
        <p className="mt-8 rounded-full bg-mint-soft px-4 py-2 text-sm font-semibold text-mint-deep">Cuenta vinculada ✓ · +{POINTS.google} puntos</p>
      )}

      <div className="mt-auto grid w-full gap-3 pt-8">
        <Link to={`/?r=${report.id}`} className="btn-primary">
          <MapPinned className="h-5 w-5" /> Verlo en el mapa
        </Link>
        <ShareButton report={report} label="Compartir con mis vecinos" />
        <button className="btn-soft" onClick={onAnother}>
          <Plus className="h-4 w-4" /> Reportar otro hueco
        </button>
      </div>
    </div>
  )
}

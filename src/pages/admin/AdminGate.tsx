import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { LoaderCircle, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { GoogleButton } from '../../components/GoogleButton'
import { PinMark } from '../../components/Logo'
import AdminPage from './AdminPage'
import { authErrorMessage } from '../../lib/authErrors'
import { useDocumentMeta } from '../../hooks/useDocumentMeta'

export default function AdminGate() {
  const { user, loading, isAdmin, adminChecked, signInGoogle, signOutUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useDocumentMeta({ title: 'Panel de control', path: '/admin', noindex: true })

  if (loading || (user && !user.isAnonymous && !adminChecked)) {
    return (
      <div className="grid h-dvh place-items-center bg-cream-100">
        <LoaderCircle className="h-7 w-7 animate-spin text-coral" />
      </div>
    )
  }

  if (user && !user.isAnonymous && isAdmin) return <AdminPage />

  const notAllowed = user && !user.isAnonymous && !isAdmin

  return (
    <div className="grid min-h-dvh place-items-center bg-blobs px-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="card w-full max-w-sm p-7"
      >
        <PinMark size={46} className="animate-floaty" />
        <p className="mt-5 text-sm font-semibold text-lavender-deep">Solo para administradores</p>
        <h1 className="title mt-1">Panel de control</h1>

        {notAllowed ? (
          <>
            <p className="mt-4 flex gap-2 rounded-2xl bg-coral-soft px-3 py-3 text-sm text-coral-deep">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>
                <b>{user.email}</b> no tiene permisos de administrador.
              </span>
            </p>
            <button className="btn-soft mt-5 w-full" onClick={signOutUser}>
              Usar otra cuenta
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-ink-muted">Ingresa con una cuenta de Google autorizada para gestionar los reportes.</p>
            <div className="mt-6">
              <GoogleButton
                label={busy ? 'Conectando…' : 'Ingresar con Google'}
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setErr(null)
                  try {
                    await signInGoogle()
                  } catch (e) {
                    console.error(e)
                    setErr(authErrorMessage(e))
                  } finally {
                    setBusy(false)
                  }
                }}
              />
            </div>
            {err && <p className="mt-3 text-sm text-coral-deep">{err}</p>}
          </>
        )}
        <Link to="/" className="mt-6 block text-center text-sm font-semibold text-ink-muted hover:text-ink">
          ← Volver al mapa
        </Link>
      </motion.div>
    </div>
  )
}

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Cloud, LayoutDashboard, ListChecks, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { BottomSheet } from './BottomSheet'
import { GoogleButton } from './GoogleButton'
import { authErrorMessage } from '../lib/authErrors'

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, isAdmin, linkGoogle, signOutUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const anonymous = user?.isAnonymous ?? true

  const onLink = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const result = await linkGoogle()
      setMsg(
        result === 'linked'
          ? '¡Listo! Tus reportes ahora están guardados en tu cuenta de Google.'
          : 'Esa cuenta ya existía: iniciaste sesión con ella.',
      )
    } catch (err) {
      console.error(err)
      setMsg(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} label="Tu cuenta">
      <div className="space-y-5 px-5 pb-6 pt-1">
        {anonymous ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-butter-soft text-3xl">🙋</div>
              <div>
                <p className="font-display text-2xl font-semibold text-ink">¡Hola, vecino!</p>
                <p className="text-sm text-ink-muted">Estás reportando sin cuenta.</p>
              </div>
            </div>
            <div className="rounded-[24px] bg-sky-soft p-4">
              <p className="mb-3 flex gap-2 text-sm text-ink-soft">
                <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-sky-deep" />
                <span>
                  Si quieres, vincula tu Google para <b className="text-ink">no perder tus reportes</b> si cambias de
                  celular.
                </span>
              </p>
              <GoogleButton onClick={onLink} disabled={busy} label={busy ? 'Conectando…' : 'Vincular con Google'} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="h-14 w-14 rounded-full ring-4 ring-coral-soft" referrerPolicy="no-referrer" />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full bg-coral-soft font-display text-xl font-semibold text-coral-deep">
                {user?.displayName?.[0] ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-semibold text-ink">
                ¡Hola, {user?.displayName?.split(' ')[0] ?? 'vecino'}!
              </p>
              <p className="truncate text-sm text-ink-muted">{user?.email}</p>
            </div>
          </div>
        )}

        {msg && <p className="rounded-2xl bg-mint-soft px-4 py-3 text-sm font-medium text-mint-deep">{msg}</p>}

        <nav className="space-y-2">
          <SheetLink
            to="/mis-reportes"
            icon={<ListChecks className="h-5 w-5" />}
            tone="bg-lavender-soft text-lavender-deep"
            label="Mis reportes"
            onClick={onClose}
          />
          {isAdmin && (
            <SheetLink
              to="/admin"
              icon={<LayoutDashboard className="h-5 w-5" />}
              tone="bg-butter-soft text-butter-deep"
              label="Panel de administración"
              onClick={onClose}
            />
          )}
        </nav>

        {!anonymous && (
          <button
            className="btn-soft w-full"
            onClick={async () => {
              await signOutUser()
              onClose()
            }}
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

function SheetLink({
  to,
  icon,
  tone,
  label,
  onClick,
}: {
  to: string
  icon: ReactNode
  tone: string
  label: string
  onClick: () => void
}) {
  return (
    <Link to={to} onClick={onClick} className="card flex items-center gap-3 px-4 py-3.5 transition active:scale-[.98]">
      <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}>{icon}</span>
      <span className="flex-1 font-display text-lg font-medium text-ink">{label}</span>
      <ChevronRight className="h-5 w-5 text-ink-faint" />
    </Link>
  )
}

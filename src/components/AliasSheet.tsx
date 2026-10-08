import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Dices, LoaderCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { haptic } from '../lib/fx'
import { ALIAS_PATTERN, AVATARS, deleteProfile, randomAlias, saveProfile } from '../lib/profiles'
import type { Profile } from '../lib/types'
import { BottomSheet } from './BottomSheet'

/** Elegir alias + emoji para aparecer en el ranking (nunca se muestra el nombre real). */
export function AliasSheet({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: Profile | null }) {
  const { user } = useAuth()
  const [alias, setAlias] = useState('')
  const [emoji, setEmoji] = useState<string>(AVATARS[0])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAlias(profile?.alias ?? randomAlias())
    setEmoji(profile?.emoji ?? AVATARS[Math.floor(Math.random() * AVATARS.length)])
    setErr(null)
  }, [open, profile])

  const valid = ALIAS_PATTERN.test(alias.trim())

  const save = async () => {
    if (!user || !valid) return
    setBusy(true)
    setErr(null)
    try {
      await saveProfile(user.uid, alias, emoji)
      haptic([10, 40, 20])
      onClose()
    } catch (e) {
      console.error(e)
      setErr('No se pudo guardar tu alias. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!user) return
    setBusy(true)
    try {
      await deleteProfile(user.uid)
      onClose()
    } catch (e) {
      console.error(e)
      setErr('No se pudo quitar tu alias.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} label="Tu alias en el ranking">
      <div className="space-y-5 px-5 pb-6 pt-1">
        <div className="text-center">
          <motion.div
            key={emoji}
            initial={{ scale: 0.5, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 14 }}
            className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-butter-soft text-5xl shadow-soft"
          >
            {emoji}
          </motion.div>
          <p className="mt-3 font-display text-2xl font-semibold">{alias.trim() || 'Tu alias'}</p>
          <p className="text-sm text-ink-muted">Así te verán en el ranking. Nunca mostramos tu nombre real.</p>
        </div>

        <div className="grid grid-cols-8 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => {
                haptic(6)
                setEmoji(a)
              }}
              className={`grid aspect-square place-items-center rounded-2xl text-2xl transition active:scale-90 ${
                a === emoji ? 'bg-coral-soft ring-2 ring-coral' : 'bg-white shadow-card'
              }`}
              aria-label={`Elegir ${a}`}
              aria-pressed={a === emoji}
            >
              {a}
            </button>
          ))}
        </div>

        <div>
          <div className="flex gap-2">
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value.slice(0, 20))}
              className="field"
              placeholder="Tu alias"
              maxLength={20}
              aria-label="Alias"
            />
            <button className="btn-soft shrink-0 px-4" onClick={() => setAlias(randomAlias())} aria-label="Sugerir otro alias">
              <Dices className="h-5 w-5" />
            </button>
          </div>
          <p className={`mt-1.5 text-xs ${valid || !alias ? 'text-ink-muted' : 'text-coral-deep'}`}>
            De 3 a 20 caracteres: letras, números, espacios, punto o guion.
          </p>
        </div>

        {err && <p className="rounded-2xl bg-coral-soft px-4 py-2 text-sm text-coral-deep">{err}</p>}

        <button className="btn-primary w-full" onClick={save} disabled={!valid || busy}>
          {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
          {profile ? 'Guardar cambios' : 'Entrar al ranking'}
        </button>
        {profile && (
          <button onClick={remove} disabled={busy} className="w-full py-1 text-sm font-semibold text-ink-muted hover:text-coral-deep">
            Quitarme del ranking
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

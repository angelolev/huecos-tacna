import { CheckCircle2, CircleDashed } from 'lucide-react'
import { PinMark } from './Logo'

export function SetupScreen({ firebase, maps }: { firebase: boolean; maps: boolean }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-blobs px-6">
      <div className="card w-full max-w-md space-y-4 p-7">
        <PinMark size={44} className="animate-floaty" />
        <h1 className="title">Falta configurar</h1>
        <p className="text-sm text-ink-muted">
          Copia <code className="rounded bg-lavender-soft px-1 text-lavender-deep">.env.example</code> a{' '}
          <code className="rounded bg-lavender-soft px-1 text-lavender-deep">.env.local</code>, completa las variables y
          reinicia <code className="rounded bg-lavender-soft px-1 text-lavender-deep">pnpm dev</code>.
        </p>
        <ul className="space-y-2 text-sm">
          <Item ok={firebase} label="Firebase (VITE_FIREBASE_*)" />
          <Item ok={maps} label="Google Maps (VITE_GOOGLE_MAPS_API_KEY)" />
        </ul>
      </div>
    </div>
  )
}

function Item({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-ink-soft">
      {ok ? <CheckCircle2 className="h-4 w-4 text-mint-deep" /> : <CircleDashed className="h-4 w-4 text-coral-deep" />}
      {label}
    </li>
  )
}

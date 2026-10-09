import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { claimGoogleBonus, ensureProfile } from '../lib/profiles'
import { trackEvent } from '../lib/analytics'
import { completeTransfer, prepareTransfer } from '../lib/transfer'

interface AuthValue {
  user: User | null
  version: number
  loading: boolean
  isAdmin: boolean
  adminChecked: boolean
  /** Vincula la sesión anónima actual con Google (conserva los reportes). */
  linkGoogle: () => Promise<'linked' | 'switched'>
  signInGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

// Mientras se traspasan los reportes de una sesión anónima a una cuenta existente, no asignamos
// alias nuevo: la cuenta debe heredar el alias de la sesión anónima.
let transferring = false

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

/**
 * Al VINCULAR una sesión anónima con Google, Firebase solo copia el correo: el nombre y la foto
 * quedan en `providerData`. Los pasamos al perfil para mostrarlos. Devuelve si cambió algo.
 */
async function syncGoogleProfile(u: User) {
  const google = u.providerData.find((p) => p.providerId === 'google.com')
  if (!google) return false
  const displayName = u.displayName || google.displayName
  const photoURL = u.photoURL || google.photoURL
  if (displayName === u.displayName && photoURL === u.photoURL) return false
  await updateProfile(u, { displayName, photoURL })
  return true
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminChecked, setAdminChecked] = useState(false)
  // linkWithPopup muta el mismo objeto User; este contador fuerza el re-render.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) {
        // Sin sesión: entramos como anónimo de forma invisible.
        signInAnonymously(auth).catch((err) => {
          console.error('No se pudo iniciar sesión anónima', err)
          setLoading(false)
        })
        return
      }
      setUser(u)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setAdminChecked(false)
    setIsAdmin(false)
    if (!user?.email || user.isAnonymous) {
      setAdminChecked(true)
      return
    }
    getDoc(doc(db, 'admins', user.email))
      .then((snap) => !cancelled && setIsAdmin(snap.exists()))
      .catch(() => !cancelled && setIsAdmin(false))
      .finally(() => !cancelled && setAdminChecked(true))
    return () => {
      cancelled = true
    }
  }, [user, version])

  // Cuentas que se vincularon antes de copiar el nombre y la foto de Google.
  useEffect(() => {
    if (!user || user.isAnonymous) return
    syncGoogleProfile(user)
      .then((changed) => changed && setVersion((v) => v + 1))
      .catch((e) => console.error('No se pudo copiar el perfil de Google', e))
  }, [user, version])

  // Bono de puntos la primera vez que la cuenta entra con Google (vinculando o iniciando sesión).
  useEffect(() => {
    if (!user || user.isAnonymous || !user.providerData.some((p) => p.providerId === 'google.com')) return
    // Token fresco: las reglas leen `firebase.identities`, que recién incluye Google tras vincular.
    user
      .getIdToken(true)
      .then(() => claimGoogleBonus(user.uid))
      .then(() => (transferring ? undefined : ensureProfile(user.uid)))
      .catch((e) => console.error('No se pudo registrar el bono de Google', e))
  }, [user, version])

  const linkGoogle = useCallback(async () => {
    const current = auth.currentUser
    if (!current) throw new Error('Sin sesión')
    try {
      const { user: linked } = await linkWithPopup(current, provider)
      await syncGoogleProfile(linked).catch((e) => console.error('No se pudo copiar el perfil de Google', e))
      setVersion((v) => v + 1)
      trackEvent('google_linked', { result: 'linked' })
      return 'linked' as const
    } catch (err) {
      // La cuenta de Google ya existe (p. ej. el admin u otro celular): iniciamos sesión con ella
      // y le pasamos los reportes y el alias de esta sesión anónima, para no perder los puntos.
      if (err instanceof FirebaseError && err.code === 'auth/credential-already-in-use') {
        const cred = GoogleAuthProvider.credentialFromError(err)
        if (cred) {
          // Si no se puede preparar el traspaso, NO cambiamos de cuenta: la sesión anónima
          // (con sus reportes) se conserva y la persona puede reintentar.
          const transfer = current.isAnonymous ? await prepareTransfer(current.uid) : null
          transferring = true
          try {
            const { user: google } = await signInWithCredential(auth, cred)
            if (transfer) {
              await completeTransfer(transfer, google.uid).catch((e) => console.error('No se pudieron traspasar los reportes', e))
            }
            await ensureProfile(google.uid).catch((e) => console.error('No se pudo asignar el alias', e))
          } finally {
            transferring = false
          }
          trackEvent('google_linked', { result: 'switched' })
          return 'switched' as const
        }
      }
      throw err
    }
  }, [])

  // Login del admin: si hay una sesión anónima, se VINCULA (o se traspasa) en vez de reemplazarla,
  // así los reportes hechos en este navegador no quedan huérfanos.
  const signInGoogle = useCallback(async () => {
    if (auth.currentUser?.isAnonymous) {
      await linkGoogle()
      return
    }
    await signInWithPopup(auth, provider)
  }, [linkGoogle])

  const signOutUser = useCallback(async () => {
    await signOut(auth)
  }, [])

  return (
    <AuthContext.Provider value={{ user, version, loading, isAdmin, adminChecked, linkGoogle, signInGoogle, signOutUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

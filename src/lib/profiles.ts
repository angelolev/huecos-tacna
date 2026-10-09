import { collection, collectionGroup, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { Confirmation, GoogleBonus } from './points'
import type { Profile } from './types'

// Animal + rasgo + número de 3 cifras: ~345 000 combinaciones, para que casi no se repitan.
const ANIMALS: [string, string][] = [
  ['Llama', '🦙'], ['Alpaca', '🦙'], ['Vicuña', '🦙'], ['Cóndor', '🦅'], ['Halcón', '🦅'], ['Zorro', '🦊'],
  ['Puma', '🐆'], ['Jaguar', '🐆'], ['Colibrí', '🐦'], ['Picaflor', '🐦'], ['Búho', '🦉'], ['Oso', '🐻'],
  ['Panda', '🐼'], ['Tortuga', '🐢'], ['Loro', '🦜'], ['Lobo', '🐺'], ['Pingüino', '🐧'], ['Delfín', '🐬'],
  ['Venado', '🦌'], ['Mono', '🐒'], ['Tigre', '🐯'], ['Koala', '🐨'], ['Gato', '🐱'], ['Rana', '🐸'],
]
const TRAITS = ['Veloz', 'Atento', 'Valiente', 'Curioso', 'Andino', 'Sereno', 'Audaz', 'Alegre', 'Astuto', 'Sabio', 'Feliz', 'Bravo', 'Noble', 'Ágil', 'Tenaz', 'Leal']

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

/** Alias y emoji al azar, p. ej. 🦊 ZorroAstuto427 (máx. 19 caracteres; las reglas permiten 20). */
export function randomProfile() {
  const [animal, emoji] = pick(ANIMALS)
  const number = String(100 + Math.floor(Math.random() * 900))
  return { alias: `${animal}${pick(TRAITS)}${number}`, emoji }
}

export function subscribeProfiles(onData: (profiles: Map<string, Profile>) => void, onError: (e: Error) => void) {
  return onSnapshot(
    collection(db, 'profiles'),
    (snap) => onData(new Map(snap.docs.map((d) => [d.id, { uid: d.id, alias: d.data().alias, emoji: d.data().emoji }]))),
    onError,
  )
}

const ensuring = new Map<string, Promise<Profile>>()

/**
 * Alias del ranking: se asigna solo, al azar, la primera vez que la persona gana puntos, y no se
 * puede cambiar (las reglas solo permiten crearlo). Devuelve el que ya tenía si existe.
 */
export function ensureProfile(uid: string): Promise<Profile> {
  const pending = ensuring.get(uid)
  if (pending) return pending
  const task = (async () => {
    const ref = doc(db, 'profiles', uid)
    const read = async () => {
      const snap = await getDoc(ref)
      return snap.exists() ? { uid, alias: snap.data().alias as string, emoji: snap.data().emoji as string } : null
    }
    const existing = await read()
    if (existing) return existing
    const p = randomProfile()
    try {
      await setDoc(ref, { ...p, updatedAt: serverTimestamp() })
      return { uid, ...p }
    } catch (e) {
      // Otro dispositivo o pestaña lo creó un instante antes: nos quedamos con ese.
      const other = await read()
      if (other) return other
      throw e
    }
  })().finally(() => ensuring.delete(uid))
  ensuring.set(uid, task)
  return task
}

/** Todas las confirmaciones (`reports/{id}/confirmations/{uid}`), para los puntos de quien confirma. */
export function subscribeConfirmations(onData: (c: Confirmation[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    collectionGroup(db, 'confirmations'),
    (snap) =>
      onData(
        snap.docs.map((d) => ({
          uid: d.id,
          reportId: d.ref.parent.parent?.id ?? '',
          createdAt: (d.data().createdAt as Timestamp | undefined)?.toDate() ?? null,
        })),
      ),
    onError,
  )
}

/** Bonos por entrar con Google (`googleBonus/{uid}`), para los puntos. */
export function subscribeGoogleBonuses(onData: (b: GoogleBonus[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    collection(db, 'googleBonus'),
    (snap) => onData(snap.docs.map((d) => ({ uid: d.id, createdAt: (d.data().createdAt as Timestamp | undefined)?.toDate() ?? null }))),
    onError,
  )
}

/** Crea el bono de Google si la cuenta aún no lo tiene. Las reglas exigen Google vinculado y no permiten repetirlo. */
export async function claimGoogleBonus(uid: string) {
  const ref = doc(db, 'googleBonus', uid)
  if ((await getDoc(ref)).exists()) return false
  await setDoc(ref, { createdAt: serverTimestamp() })
  return true
}

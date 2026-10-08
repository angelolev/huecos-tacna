import { collection, collectionGroup, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { Confirmation, GoogleBonus } from './points'
import type { Profile } from './types'

export const AVATARS = ['🦙', '🐆', '🦊', '🐻', '🐼', '🐸', '🐙', '🦉', '🐢', '🦜', '🐝', '🦖', '🌵', '🌶️', '🥑', '⚡'] as const

const ANIMALS = ['Llama', 'Vicuña', 'Cóndor', 'Zorro', 'Puma', 'Colibrí', 'Picaflor', 'Alpaca']
const TRAITS = ['Veloz', 'Atento', 'Valiente', 'Curioso', 'Andino', 'Sereno', 'Audaz', 'Alegre']

export function randomAlias() {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
  return `${pick(ANIMALS)}${pick(TRAITS)}`
}

/** Mismo patrón que firestore.rules: letras (con tildes), números, espacio, punto, guion y guion bajo. */
export const ALIAS_PATTERN = /^[\p{L}\p{N} _.-]{3,20}$/u

export function subscribeProfiles(onData: (profiles: Map<string, Profile>) => void, onError: (e: Error) => void) {
  return onSnapshot(
    collection(db, 'profiles'),
    (snap) => onData(new Map(snap.docs.map((d) => [d.id, { uid: d.id, alias: d.data().alias, emoji: d.data().emoji }]))),
    onError,
  )
}

export async function saveProfile(uid: string, alias: string, emoji: string) {
  await setDoc(doc(db, 'profiles', uid), { alias: alias.trim(), emoji, updatedAt: serverTimestamp() })
}

export async function deleteProfile(uid: string) {
  await deleteDoc(doc(db, 'profiles', uid))
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

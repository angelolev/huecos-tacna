import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

/** Premio del ranking mensual de una ciudad (`prizes/{id}`). Solo los admins los crean y editan. */
export interface Prize {
  id: string
  cityId: string
  /** Mes al que corresponde, "2026-10". */
  month: string
  /** Puesto del ranking que lo gana (1 = campeón). */
  place: number
  emoji: string
  title: string
  detail: string
  /** Quién lo auspicia (opcional). */
  sponsor: string
}

export const MAX_PRIZE_PLACE = 10

const prizesCol = collection(db, 'prizes')

/** "2026-10" para la fecha dada (por defecto, hoy). */
export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** "2026-10" → "octubre" (o "octubre de 2027" si no es de este año). */
export function monthLabel(key: string, now = new Date()) {
  const [y, m] = key.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  const opts: Intl.DateTimeFormatOptions = y === now.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' }
  return new Intl.DateTimeFormat('es-PE', opts).format(date)
}

const MEDALS = ['🥇', '🥈', '🥉']

/** "🥇 1.er puesto", "4.º puesto"… */
export function placeLabel(place: number) {
  const medal = MEDALS[place - 1]
  const ordinal = place === 1 || place === 3 ? `${place}.er` : `${place}.º`
  return `${medal ? `${medal} ` : ''}${ordinal} puesto`
}

export function subscribePrizes(onData: (prizes: Prize[]) => void, onError: (err: Error) => void) {
  return onSnapshot(
    prizesCol,
    (snap) =>
      onData(
        snap.docs
          .map((d) => {
            const p = d.data()
            return {
              id: d.id,
              cityId: p.cityId,
              month: p.month,
              place: p.place ?? 1,
              emoji: p.emoji ?? '🎁',
              title: p.title ?? '',
              detail: p.detail ?? '',
              sponsor: p.sponsor ?? '',
            } satisfies Prize
          })
          .sort((a, b) => a.place - b.place || a.title.localeCompare(b.title, 'es')),
      ),
    onError,
  )
}

/** Crea (sin `id`) o reemplaza un premio. */
export async function savePrize(prize: Omit<Prize, 'id'> & { id?: string }) {
  const { id, ...data } = prize
  const ref = id ? doc(prizesCol, id) : doc(prizesCol)
  await setDoc(ref, {
    ...data,
    title: data.title.trim().slice(0, 60),
    detail: data.detail.trim().slice(0, 200),
    sponsor: data.sponsor.trim().slice(0, 60),
    ...(id ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp(),
  }, { merge: !!id })
}

export async function deletePrize(id: string) {
  await deleteDoc(doc(prizesCol, id))
}

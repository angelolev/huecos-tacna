import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Traspaso de reportes de una sesión anónima a una cuenta de Google que ya existía
 * (p. ej. el admin, o alguien que ya vinculó Google en otro celular). Ver `transfers` en firestore.rules.
 */
export interface PreparedTransfer {
  fromUid: string
  code: string
  reportIds: string[]
}

/** Paso 1 (aún como anónimo): si tiene reportes, deja una autorización con un código secreto. */
export async function prepareTransfer(anonUid: string): Promise<PreparedTransfer | null> {
  const snap = await getDocs(query(collection(db, 'reports'), where('reporterUid', '==', anonUid)))
  const profile = await getDoc(doc(db, 'profiles', anonUid))
  if (snap.empty && !profile.exists()) return null
  const code = `${crypto.randomUUID()}${crypto.randomUUID()}`
  await setDoc(doc(db, 'transfers', anonUid), { code, createdAt: serverTimestamp() })
  return { fromUid: anonUid, code, reportIds: snap.docs.map((d) => d.id) }
}

/** Paso 2 (ya con Google): acepta el traspaso, reclama los reportes y copia el alias si no tenía uno. */
export async function completeTransfer(t: PreparedTransfer, toUid: string) {
  await updateDoc(doc(db, 'transfers', t.fromUid), { to: toUid, proof: t.code })

  for (let i = 0; i < t.reportIds.length; i += 400) {
    const batch = writeBatch(db)
    t.reportIds.slice(i, i + 400).forEach((id) => batch.update(doc(db, 'reports', id), { reporterUid: toUid }))
    await batch.commit()
  }

  const [from, to] = await Promise.all([getDoc(doc(db, 'profiles', t.fromUid)), getDoc(doc(db, 'profiles', toUid))])
  if (from.exists() && !to.exists()) {
    await setDoc(doc(db, 'profiles', toUid), { alias: from.data().alias, emoji: from.data().emoji, updatedAt: serverTimestamp() })
  }
  return t.reportIds.length
}

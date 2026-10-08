import {
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAt,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { DocumentSnapshot, Timestamp } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { distanceBetween, geohashForLocation, geohashQueryBounds } from 'geofire-common'
import { db, storage } from './firebase'
import type { LatLng, Report, ReportPhoto, ReportStatus, Severity } from './types'

export const DUPLICATE_RADIUS_M = 25
export const RATE_LIMIT_SECONDS = 120

const reportsCol = collection(db, 'reports')

const toDate = (v: unknown) => (v ? (v as Timestamp).toDate() : null)

function fromDoc(snap: DocumentSnapshot): Report {
  const d = snap.data() ?? {}
  return {
    id: snap.id,
    cityId: d.cityId ?? null,
    lat: d.lat,
    lng: d.lng,
    geohash: d.geohash,
    photos: d.photos ?? [],
    severity: d.severity,
    note: d.note ?? '',
    status: d.status,
    confirmations: d.confirmations ?? 0,
    reporterUid: d.reporterUid,
    address: d.address ?? null,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    lastConfirmedAt: toDate(d.lastConfirmedAt),
  }
}

export function subscribeReports(
  onData: (reports: Report[]) => void,
  onError: (err: Error) => void,
  max = 1500,
) {
  const q = query(reportsCol, orderBy('createdAt', 'desc'), limit(max))
  return onSnapshot(q, (snap) => onData(snap.docs.map(fromDoc)), onError)
}

export function subscribeMyReports(
  uid: string,
  onData: (reports: Report[]) => void,
  onError: (err: Error) => void,
) {
  // Sin orderBy para no requerir índice compuesto; se ordena en el cliente.
  const q = query(reportsCol, where('reporterUid', '==', uid))
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs
          .map(fromDoc)
          .sort((a, b) => (b.createdAt?.getTime() ?? Infinity) - (a.createdAt?.getTime() ?? Infinity)),
      ),
    onError,
  )
}

export async function getReport(id: string) {
  const snap = await getDoc(doc(reportsCol, id))
  return snap.exists() ? fromDoc(snap) : null
}

/** Reportes activos (no reparados) dentro de `radiusM` metros, del más cercano al más lejano. */
export async function findNearby(center: LatLng, radiusM = DUPLICATE_RADIUS_M) {
  const c: [number, number] = [center.lat, center.lng]
  const bounds = geohashQueryBounds(c, radiusM)
  const snaps = await Promise.all(
    bounds.map(([start, end]) => getDocs(query(reportsCol, orderBy('geohash'), startAt(start), endAt(end)))),
  )
  const seen = new Set<string>()
  const results: (Report & { distance: number })[] = []
  for (const snap of snaps) {
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      const r = fromDoc(d)
      if (r.status === 'reparado' || r.status === 'rechazado') continue
      const distance = distanceBetween([r.lat, r.lng], c) * 1000
      if (distance <= radiusM) results.push({ ...r, distance })
    }
  }
  return results.sort((a, b) => a.distance - b.distance)
}

/** Segundos que faltan para poder enviar otro reporte (0 = puede reportar). */
export async function secondsUntilCanReport(uid: string) {
  const snap = await getDoc(doc(db, 'rateLimits', uid))
  const last = snap.exists() ? toDate(snap.data().lastReportAt) : null
  if (!last) return 0
  const elapsed = (Date.now() - last.getTime()) / 1000
  return Math.max(0, Math.ceil(RATE_LIMIT_SECONDS - elapsed))
}

interface NewReport {
  uid: string
  cityId: string
  location: LatLng
  photos: Blob[]
  severity: Severity
  note: string
  address: string | null
  onProgress?: (fraction: number) => void
}

export async function createReport({ uid, cityId, location, photos, severity, note, address, onProgress }: NewReport) {
  const reportRef = doc(reportsCol)
  const total = photos.reduce((sum, p) => sum + p.size, 0)
  const loaded = photos.map(() => 0)

  const uploaded: ReportPhoto[] = await Promise.all(
    photos.map(async (blob, i) => {
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `reports/${uid}/${reportRef.id}/${i + 1}.${ext}`
      const task = uploadBytesResumable(ref(storage, path), blob, {
        contentType: blob.type,
        cacheControl: 'public,max-age=31536000',
      })
      task.on('state_changed', (s) => {
        loaded[i] = s.bytesTransferred
        onProgress?.(loaded.reduce((a, b) => a + b, 0) / total)
      })
      await task
      return { path, url: await getDownloadURL(task.snapshot.ref) }
    }),
  )

  const batch = writeBatch(db)
  batch.set(reportRef, {
    cityId,
    lat: location.lat,
    lng: location.lng,
    geohash: geohashForLocation([location.lat, location.lng]),
    photos: uploaded,
    severity,
    note: note.trim().slice(0, 280),
    status: 'pendiente',
    confirmations: 0,
    reporterUid: uid,
    address: address ? address.slice(0, 200) : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(doc(db, 'rateLimits', uid), { lastReportAt: serverTimestamp() })
  await batch.commit()
  return reportRef.id
}

export async function hasConfirmed(reportId: string, uid: string) {
  const snap = await getDoc(doc(db, 'reports', reportId, 'confirmations', uid))
  return snap.exists()
}

export async function confirmReport(reportId: string, uid: string) {
  const batch = writeBatch(db)
  batch.update(doc(reportsCol, reportId), {
    confirmations: increment(1),
    lastConfirmedAt: serverTimestamp(),
  })
  batch.set(doc(db, 'reports', reportId, 'confirmations', uid), { createdAt: serverTimestamp() })
  await batch.commit()
}

export async function updateReportStatus(reportId: string, status: ReportStatus) {
  await updateDoc(doc(reportsCol, reportId), { status, updatedAt: serverTimestamp() })
}

export async function deleteReport(report: Report) {
  await Promise.allSettled(report.photos.map((p) => deleteObject(ref(storage, p.path))))
  await deleteDoc(doc(reportsCol, report.id))
}

/** Rechaza si la promesa tarda más de `ms` (útil con mala señal). */
export function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

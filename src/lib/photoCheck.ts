import { auth } from './firebase'
import { compressImage } from './image'

// Mirror the types in api/validate-photo.ts (api/ is outside the app's tsconfig).
export type PhotoVerdict = 'ok' | 'not_road' | 'inappropriate' | 'unchecked'
export type PhotoSlot = 'closeup' | 'context'

// Smaller copy just for the check: enough detail to recognize a road, ~4x fewer tokens than the upload.
const CHECK_SIDE = 768

/**
 * Asks /api/validate-photo whether the photo shows a road and nothing inappropriate.
 * Fails open ('unchecked') when signed out, offline or the API is down, so reporting never gets blocked.
 */
export async function checkPhoto(photo: Blob, slot: PhotoSlot): Promise<PhotoVerdict> {
  const user = auth.currentUser
  if (!user) return 'unchecked'
  try {
    const small = await compressImage(photo, CHECK_SIDE)
    const res = await fetch(`/api/validate-photo?slot=${slot}`, {
      method: 'POST',
      headers: { 'Content-Type': small.type, Authorization: `Bearer ${await user.getIdToken()}` },
      body: small,
    })
    if (!res.ok) return 'unchecked'
    const { verdict } = (await res.json()) as { verdict?: PhotoVerdict }
    return verdict ?? 'unchecked'
  } catch {
    return 'unchecked'
  }
}

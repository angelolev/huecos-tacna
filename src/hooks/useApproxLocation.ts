import { useEffect, useState } from 'react'
import { cachedApproxLocation, getApproxLocation } from '../lib/approxLocation'
import type { ApproxLocation } from '../lib/approxLocation'

/** Ubicación aproximada por IP: llega antes que el GPS y funciona aunque se niegue el permiso. */
export function useApproxLocation() {
  const [approx, setApprox] = useState<ApproxLocation | null>(cachedApproxLocation)

  useEffect(() => {
    if (approx) return
    let cancelled = false
    getApproxLocation().then((a) => !cancelled && a && setApprox(a))
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return approx
}

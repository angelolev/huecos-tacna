import { useEffect, useState } from 'react'
import { subscribeMyReports, subscribeReports } from '../lib/reports'
import type { Report } from '../lib/types'

export function useReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeReports(
        (r) => {
          setReports(r)
          setLoading(false)
        },
        (err) => {
          console.error(err)
          setError('No se pudieron cargar los reportes')
          setLoading(false)
        },
      ),
    [],
  )

  return { reports, loading, error }
}

export function useMyReports(uid: string | undefined) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    return subscribeMyReports(
      uid,
      (r) => {
        setReports(r)
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setLoading(false)
      },
    )
  }, [uid])

  return { reports, loading }
}

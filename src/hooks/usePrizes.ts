import { useEffect, useState } from 'react'
import { subscribePrizes } from '../lib/prizes'
import type { Prize } from '../lib/prizes'

/** Todos los premios (son pocos); cada pantalla filtra por ciudad y mes. */
export function usePrizes() {
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribePrizes(
        (p) => {
          setPrizes(p)
          setLoading(false)
        },
        (err) => {
          console.error(err)
          setError('No se pudieron cargar los premios')
          setLoading(false)
        },
      ),
    [],
  )

  return { prizes, loading, error }
}

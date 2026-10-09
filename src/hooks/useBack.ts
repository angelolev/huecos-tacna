import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { closeLayer, openLayer } from '../lib/backStack'

/**
 * "Volver" como el botón atrás del celular: regresa a la pantalla anterior. Si se entró directo
 * (enlace compartido, PWA recién abierta) no hay a dónde volver y va a `fallback`.
 */
export function useBack(fallback = '/') {
  const navigate = useNavigate()
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, fallback])
}

/** Mientras `open` sea true, el botón "atrás" llama a `onClose` en vez de salir de la pantalla. */
export function useBackClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const id = openLayer(() => closeRef.current())
    return () => closeLayer(id)
  }, [open])
}

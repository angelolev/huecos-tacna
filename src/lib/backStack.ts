/**
 * Botón "atrás" (Android, gesto de iOS o navegador) que cierra hojas y modales en vez de salir
 * de la pantalla.
 *
 * Al abrir una capa se agrega al historial una entrada "fantasma" con la misma URL. Volver atrás
 * la quita y cierra la capa de arriba. Si la capa se cierra desde la UI (X, tocar fuera, deslizar),
 * quitamos nosotros la entrada fantasma para que el historial quede como estaba.
 */

const MARK = '__capa'

type Layer = { id: number; close: () => void }
const layers: Layer[] = []
let nextId = 1
let listening = false

const onGhost = () => !!(window.history.state as Record<string, unknown> | null)?.[MARK]

function pushGhost() {
  window.history.pushState({ ...(window.history.state ?? {}), [MARK]: true }, '')
}

function listen() {
  if (listening) return
  listening = true
  window.addEventListener('popstate', () => {
    if (onGhost()) {
      // Entrada fantasma de una capa que ya no existe (p. ej. se navegó desde la hoja): la saltamos.
      if (!layers.length) window.history.back()
      return
    }
    const top = layers.pop()
    if (!top) return
    top.close()
    // Con capas anidadas (visor de fotos sobre una hoja) la de abajo sigue abierta.
    if (layers.length) pushGhost()
  })
}

export function openLayer(close: () => void) {
  listen()
  const id = nextId++
  layers.push({ id, close })
  if (!onGhost()) pushGhost()
  return id
}

export function closeLayer(id: number) {
  const i = layers.findIndex((l) => l.id === id)
  // Ya la cerró el botón "atrás".
  if (i === -1) return
  layers.splice(i, 1)
  // Diferido: con StrictMode (o al pasar de una hoja a otra) la capa vuelve a abrirse enseguida.
  // Si en ese momento ya se navegó a otra pantalla, la entrada actual no es fantasma y no se toca.
  setTimeout(() => {
    if (!layers.length && onGhost()) window.history.back()
  }, 0)
}

/** 1 si la entrada actual del historial es fantasma (hay una capa abierta encima de la pantalla). */
export const ghostDepth = () => (onGhost() ? 1 : 0)

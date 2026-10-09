import { lazy } from 'react'
import type { ComponentType } from 'react'

/**
 * Actualizaciones de la PWA.
 *
 * El service worker nuevo toma el control apenas se instala (skipWaiting), pero la página abierta
 * sigue con el código viejo hasta recargarse; en la app instalada eso puede durar días. Aquí:
 * - buscamos versiones nuevas al volver a la app y cada 30 min;
 * - cuando hay una, recargamos en un momento que no moleste (ver UpdateWatcher en App.tsx).
 */

let pending = false
const listeners = new Set<() => void>()

export const updatePending = () => pending

export function onUpdate(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // Sin controlador previo es la primera instalación: no hay versión vieja que reemplazar.
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || pending) return
    pending = true
    listeners.forEach((fn) => fn())
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        const check = () => reg.update().catch(() => {})
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check()
        })
        setInterval(check, 30 * 60 * 1000)
      })
      .catch((e) => console.error('No se pudo registrar el service worker', e))
  })
}

const RELOAD_KEY = 'huecazo:recarga-por-version'

/**
 * Como `lazy`, pero si la pantalla no carga (su código era de una versión que ya no está en el
 * servidor) recarga la página una vez para traer la versión nueva.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory()
      .then((m) => {
        try {
          sessionStorage.removeItem(RELOAD_KEY)
        } catch {
          /* sin almacenamiento */
        }
        return m
      })
      .catch((err) => {
        let reloaded = false
        try {
          reloaded = !!sessionStorage.getItem(RELOAD_KEY)
          if (!reloaded) sessionStorage.setItem(RELOAD_KEY, '1')
        } catch {
          reloaded = true // sin almacenamiento no arriesgamos un bucle de recargas
        }
        if (reloaded) throw err
        window.location.reload()
        return new Promise<never>(() => {})
      }),
  )
}

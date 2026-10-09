/**
 * Google Analytics 4: visitas por pantalla, de dónde se conecta la gente (ciudad/región) y
 * acciones clave (reportar, confirmar, vincular Google).
 *
 * - Solo en producción y solo si existe VITE_GA_MEASUREMENT_ID.
 * - El script se carga cuando la app ya abrió, para no hacerla más lenta.
 * - Sin publicidad ni señales de Google (allow_google_signals: false).
 * - El panel /admin no se mide.
 */

const ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const enabled = () => !!ID && import.meta.env.PROD

export function initAnalytics() {
  if (!enabled() || window.gtag) return
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // gtag.js espera el objeto `arguments`, no un arreglo.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', ID, {
    // Las páginas las enviamos nosotros (trackPage): así abrir/cerrar hojas no cuenta como visita.
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })

  const load = () => {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`
    document.head.appendChild(script)
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 4000 })
  else setTimeout(load, 2000)
}

/** Una visita por pantalla (cambio de ruta). */
export function trackPage(path: string) {
  if (!enabled() || path.startsWith('/admin')) return
  // Esperamos a que la pantalla ponga su título (useDocumentMeta, pantallas que cargan aparte).
  setTimeout(() => {
    window.gtag?.('event', 'page_view', {
      page_path: path,
      page_location: `${window.location.origin}${path}${window.location.search}`,
      page_title: document.title,
    })
  }, 400)
}

/** Acciones clave: reporte enviado, reporte confirmado, cuenta de Google vinculada. */
export function trackEvent(name: 'report_created' | 'report_confirmed' | 'google_linked', params?: Record<string, string | number>) {
  if (!enabled()) return
  window.gtag?.('event', name, params)
}

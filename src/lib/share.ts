import { SEVERITY_META } from './types'
import type { Report } from './types'

/** Enlace público del reporte. En huecazo.com muestra la foto del hueco como vista previa (api/share.ts). */
export function reportShareUrl(id: string) {
  const origin = /(^|\.)huecazo\.com$/.test(location.hostname) ? 'https://huecazo.com' : location.origin
  return `${origin}/h/${id}`
}

/**
 * Abre el menú nativo para compartir (WhatsApp, Facebook…) o, si no existe, copia el enlace.
 * Devuelve 'shared' | 'copied' | 'cancelled'.
 */
export async function shareReport(report: Pick<Report, 'id' | 'address' | 'severity'>) {
  const url = reportShareUrl(report.id)
  const where = report.address ? ` en ${report.address}` : ''
  const text = `🚧 ¡Ojo con este huecazo${where}! (${SEVERITY_META[report.severity].label.toLowerCase()}). Confírmalo para que lo reparen:`

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Hueco reportado en Huecazo', text, url })
      return 'shared' as const
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled' as const
    }
  }
  await navigator.clipboard.writeText(`${text} ${url}`)
  return 'copied' as const
}

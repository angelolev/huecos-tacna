import { useEffect } from 'react'

const SITE = 'https://huecazo.com'
const DEFAULT_TITLE = 'Huecazo · Reporta huecos en las pistas de Tacna'
const DEFAULT_DESCRIPTION =
  'Mapa ciudadano de huecos en las pistas. Toma una foto, marca la ubicación y repórtalo en 30 segundos, sin registrarte. Ya disponible en Tacna.'

interface Meta {
  title?: string
  description?: string
  /** Ruta canónica, p. ej. "/acerca". */
  path?: string
  /** Páginas privadas o sin valor para buscadores (admin, mis reportes). */
  noindex?: boolean
  /** Datos estructurados extra (JSON-LD) solo para esta página. */
  jsonLd?: object
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

/** Título, descripción, URL canónica y robots por página (Google ejecuta JavaScript y los lee). */
export function useDocumentMeta({ title, description, path = '/', noindex, jsonLd }: Meta = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · Huecazo` : DEFAULT_TITLE
    const desc = description ?? DEFAULT_DESCRIPTION
    const url = `${SITE}${path}`

    document.title = fullTitle
    setMeta('meta[name="description"]', 'name', 'description', desc)
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle)
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc)
    setMeta('meta[property="og:url"]', 'property', 'og:url', url)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', desc)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url

    let script: HTMLScriptElement | null = null
    if (jsonLd) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.page = 'true'
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
    return () => script?.remove()
  }, [title, description, path, noindex, jsonLd])
}

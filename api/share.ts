// Vista previa para redes de un reporte: /h/:id → /api/share?id=:id (ver vercel.json).
// WhatsApp, Facebook y X no ejecutan JavaScript: reciben aquí el index.html con las etiquetas
// Open Graph del reporte (foto del hueco, dirección, gravedad). En el navegador, la app
// carga normalmente y la ruta /h/:id redirige al reporte en el mapa.

declare const process: { env: Record<string, string | undefined> }

const SITE = 'https://huecazo.com'
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'huecos-603c6'

const SEVERITY: Record<string, string> = { pequeno: 'pequeño', mediano: 'mediano', peligroso: 'peligroso' }
const STATUS: Record<string, string> = { pendiente: 'Por reparar', verificado: 'Verificado', reparado: '¡Ya fue reparado!' }

type FsValue = { stringValue?: string; integerValue?: string; nullValue?: null; arrayValue?: { values?: FsValue[] }; mapValue?: { fields?: Record<string, FsValue> } }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Reemplaza el content de <meta name|property="key">, o la agrega si no existe. */
function setMeta(html: string, attr: 'name' | 'property', key: string, value: string) {
  const re = new RegExp(`<meta\\s+${attr}="${key.replace(/[:]/g, '\\:')}"\\s+content="[^"]*"\\s*/?>`)
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

let shellCache: { html: string; at: number } | null = null

async function getShell(origin: string) {
  if (shellCache && Date.now() - shellCache.at < 5 * 60_000) return shellCache.html
  const res = await fetch(`${origin}/index.html`)
  const html = await res.text()
  shellCache = { html, at: Date.now() }
  return html
}

async function getReport(id: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/reports/${id}`
  const res = await fetch(url)
  if (!res.ok) return null
  const doc = (await res.json()) as { fields?: Record<string, FsValue> }
  const f = doc.fields ?? {}
  const photo = f.photos?.arrayValue?.values?.[0]?.mapValue?.fields?.url?.stringValue ?? null
  return {
    address: f.address?.stringValue ?? null,
    severity: f.severity?.stringValue ?? 'mediano',
    status: f.status?.stringValue ?? 'pendiente',
    confirmations: Number(f.confirmations?.integerValue ?? 0),
    photo,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? ''
  const shell = await getShell(url.origin)

  const html = (body: string, cache: string) =>
    new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache } })

  // Firestore genera ids de 20 caracteres alfanuméricos.
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return html(shell, 'public, max-age=0, s-maxage=3600')

  const report = await getReport(id).catch(() => null)
  if (!report) return html(shell, 'public, max-age=0, s-maxage=300')

  const severity = SEVERITY[report.severity] ?? report.severity
  const place = report.address ?? 'Tacna'
  const title = `🚧 Hueco ${severity} en ${place}`
  const supporters =
    report.confirmations > 0
      ? ` ${report.confirmations} ${report.confirmations === 1 ? 'vecino confirmó' : 'vecinos confirmaron'} que sigue ahí.`
      : ''
  const description =
    report.status === 'reparado'
      ? `¡Este hueco ya fue reparado gracias a los reportes de los vecinos! Mira el mapa de huecos en Huecazo.`
      : `${STATUS[report.status] ?? 'Por reparar'}.${supporters} ¿Lo viste? Confírmalo en Huecazo para que lo reparen antes.`
  const pageUrl = `${SITE}/h/${id}`
  const image = report.photo ?? `${SITE}/og-image.png`

  let out = shell.replace(/<title>[^<]*<\/title>/, `<title>${esc(`${title} · Huecazo`)}</title>`)
  out = out.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${pageUrl}" />`)
  out = setMeta(out, 'name', 'description', description)
  // Las páginas de cada reporte sirven para compartir, no para el índice de Google.
  out = setMeta(out, 'name', 'robots', 'noindex, follow')
  out = setMeta(out, 'property', 'og:type', 'article')
  out = setMeta(out, 'property', 'og:url', pageUrl)
  out = setMeta(out, 'property', 'og:title', title)
  out = setMeta(out, 'property', 'og:description', description)
  out = setMeta(out, 'property', 'og:image', image)
  out = setMeta(out, 'property', 'og:image:alt', `Foto del hueco en ${place}`)
  out = setMeta(out, 'name', 'twitter:title', title)
  out = setMeta(out, 'name', 'twitter:description', description)
  out = setMeta(out, 'name', 'twitter:image', image)
  if (report.photo) {
    // Las fotos no tienen tamaño fijo: quitamos las dimensiones de la imagen genérica.
    out = out.replace(/\s*<meta property="og:image:(width|height)" content="[^"]*"\s*\/?>/g, '')
  }

  return html(out, 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400')
}

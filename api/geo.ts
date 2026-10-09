// Ubicación aproximada de quien se conecta, a partir de su IP (Vercel la agrega en los encabezados
// x-vercel-ip-*). Sirve para centrar el mapa en su ciudad mientras el GPS responde, o cuando la
// persona no da permiso de ubicación. Precisión: ciudad, no calle.

const header = (request: Request, name: string) => {
  const value = request.headers.get(`x-vercel-ip-${name}`)
  if (!value) return null
  try {
    // Vercel codifica el nombre de la ciudad (p. ej. "San%20Juan%20de%20Miraflores").
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function GET(request: Request) {
  const lat = Number(header(request, 'latitude'))
  const lng = Number(header(request, 'longitude'))
  const found = header(request, 'latitude') !== null && Number.isFinite(lat) && Number.isFinite(lng)

  const body = found
    ? {
        lat,
        lng,
        city: header(request, 'city'),
        region: header(request, 'country-region'),
        country: header(request, 'country'),
      }
    : null

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Depende de la IP de cada persona: nunca se guarda en la CDN.
      'Cache-Control': 'private, no-store',
    },
  })
}

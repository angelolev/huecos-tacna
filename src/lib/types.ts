export type Severity = 'pequeno' | 'mediano' | 'peligroso'
/** `rechazado`: el admin lo marcó como falso; no se muestra en el mapa y resta puntos. */
export type ReportStatus = 'pendiente' | 'verificado' | 'reparado' | 'rechazado'

export interface ReportPhoto {
  url: string
  path: string
}

export interface Report {
  id: string
  /** Ciudad a la que pertenece (id de `cities`). `null` en reportes antiguos aún sin asignar. */
  cityId: string | null
  lat: number
  lng: number
  geohash: string
  photos: ReportPhoto[]
  severity: Severity
  note: string
  status: ReportStatus
  confirmations: number
  reporterUid: string
  address: string | null
  createdAt: Date | null
  updatedAt: Date | null
  lastConfirmedAt: Date | null
}

export interface LatLng {
  lat: number
  lng: number
}

export const TACNA_CENTER: LatLng = { lat: -18.0146, lng: -70.2536 }

export interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

/**
 * Ciudad donde funciona Huecazo (colección `cities/{id}`).
 * - `bounds`: zona donde se aceptan reportes (lo validan también las reglas de Firestore).
 * - `viewBounds`: zona urbana, para encuadrar "Toda la ciudad" en el mapa.
 */
export interface City {
  id: string
  name: string
  department: string
  enabled: boolean
  bounds: Bounds
  viewBounds: Bounds
  center: LatLng
  order: number
}

/** Ciudad inicial. Se crea en Firestore la primera vez que un admin abre el panel. */
export const TACNA_CITY: City = {
  id: 'tacna',
  name: 'Tacna',
  department: 'Tacna',
  enabled: true,
  // Todo el departamento de Tacna (mismo margen que tenían las reglas originales).
  bounds: { north: -16.9, south: -18.6, east: -69.4, west: -71.1 },
  // Zona urbana: Cercado, Alto de la Alianza, Ciudad Nueva, Pocollay, Gregorio Albarracín.
  viewBounds: { north: -17.965, south: -18.07, east: -70.2, west: -70.31 },
  center: TACNA_CENTER,
  order: 0,
}

/** Límites del Perú (con margen). Toda ciudad debe estar dentro. */
export const PERU_BOUNDS: Bounds = { north: 0.1, south: -18.6, east: -68.4, west: -81.5 }

interface Tone {
  /** color principal (pastel) */
  color: string
  /** fondo muy suave */
  soft: string
  /** texto con buen contraste */
  deep: string
}

export const SEVERITY_META: Record<Severity, Tone & { label: string; hint: string; emoji: string }> = {
  pequeno: { label: 'Pequeño', hint: 'Se puede esquivar', emoji: '🙂', color: '#7FD8A9', soft: '#DDF5E8', deep: '#22865A' },
  mediano: { label: 'Mediano', hint: 'Golpea la llanta', emoji: '😬', color: '#FFD36E', soft: '#FFF3CF', deep: '#A87B0B' },
  peligroso: { label: 'Peligroso', hint: 'Puede causar un accidente', emoji: '😱', color: '#FF8E7A', soft: '#FFE3DC', deep: '#D9563F' },
}

export const STATUS_META: Record<ReportStatus, Tone & { label: string; short: string }> = {
  pendiente: { label: 'Por reparar', short: 'Reportado', color: '#FF8E7A', soft: '#FFE3DC', deep: '#D9563F' },
  verificado: { label: 'Verificado', short: 'Verificado', color: '#B5A6FF', soft: '#EEEAFF', deep: '#5F4BC9' },
  reparado: { label: 'Reparado', short: 'Reparado', color: '#7FD8A9', soft: '#DDF5E8', deep: '#22865A' },
  rechazado: { label: 'Rechazado', short: 'Rechazado', color: '#C4BFCC', soft: '#EFEDF2', deep: '#5B5668' },
}

export const SEVERITIES = Object.keys(SEVERITY_META) as Severity[]
/** Estados del recorrido normal de un reporte (los que ve el público). */
export const STATUSES: ReportStatus[] = ['pendiente', 'verificado', 'reparado']
export const isPublic = (r: { status: ReportStatus }) => r.status !== 'rechazado'

/** Perfil público para el ranking (`profiles/{uid}`). Opcional: sin perfil no apareces en el ranking. */
export interface Profile {
  uid: string
  alias: string
  emoji: string
}

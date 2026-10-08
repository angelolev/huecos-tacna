export type Severity = 'pequeno' | 'mediano' | 'peligroso'
export type ReportStatus = 'pendiente' | 'verificado' | 'reparado'

export interface ReportPhoto {
  url: string
  path: string
}

export interface Report {
  id: string
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
}

export const SEVERITIES = Object.keys(SEVERITY_META) as Severity[]
export const STATUSES = Object.keys(STATUS_META) as ReportStatus[]

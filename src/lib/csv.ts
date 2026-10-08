import { googleMapsLink } from './geo'
import { neighborName } from './metrics'
import type { Neighbor } from './metrics'
import { SEVERITY_META, STATUS_META } from './types'
import type { Report } from './types'

function cell(value: unknown) {
  const s = value == null ? '' : String(value)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportReportsCsv(reports: Report[], cityName: (r: Report) => string, cityId?: string) {
  const header = [
    'ID', 'Ciudad', 'Fecha', 'Estado', 'Severidad', 'Confirmaciones', 'Dirección',
    'Latitud', 'Longitud', 'Nota', 'Foto 1', 'Foto 2', 'Google Maps',
  ]
  const rows = reports.map((r) => [
    r.id,
    cityName(r),
    r.createdAt?.toISOString() ?? '',
    STATUS_META[r.status]?.label ?? r.status,
    SEVERITY_META[r.severity]?.label ?? r.severity,
    r.confirmations,
    r.address ?? '',
    r.lat,
    r.lng,
    r.note,
    r.photos[0]?.url ?? '',
    r.photos[1]?.url ?? '',
    googleMapsLink(r),
  ])
  download(`huecazo-${cityId ? `${cityId}-` : ''}${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
}

export function exportNeighborsCsv(rows: Neighbor[], cityName: (id: string | null) => string, cityId?: string) {
  const header = [
    'Vecino', 'Cuenta', 'Ciudad', 'Reportes', 'Reparados', 'Falsos', 'Confirmaciones dadas',
    'Puntos', 'Primera actividad', 'Última actividad',
  ]
  const data = rows.map((n) => [
    neighborName(n),
    n.google ? 'Google' : 'Anónima',
    n.cityId ? cityName(n.cityId) : '',
    n.reports,
    n.fixed,
    n.rejected,
    n.confirmationsGiven,
    n.points,
    n.firstAt?.toISOString() ?? '',
    n.lastAt?.toISOString() ?? '',
  ])
  download(`huecazo-vecinos-${cityId ? `${cityId}-` : ''}${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data])
}

function download(filename: string, rows: unknown[][]) {
  // BOM para que Excel abra bien las tildes
  const csv = '﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

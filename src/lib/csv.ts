import { googleMapsLink } from './geo'
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
  // BOM para que Excel abra bien las tildes
  const csv = '﻿' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `huecazo-${cityId ? `${cityId}-` : ''}${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

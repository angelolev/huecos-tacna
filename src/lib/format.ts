const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
const dtf = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

export function timeAgo(date: Date | null) {
  if (!date) return 'ahora'
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'hace un momento'
}

export function formatDate(date: Date | null) {
  return date ? dtf.format(date) : '—'
}

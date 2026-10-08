import { useState } from 'react'
import type { ReactNode } from 'react'
import { Expand, MapPin, Navigation, Users } from 'lucide-react'
import { formatDate, timeAgo } from '../lib/format'
import { formatCoords, googleMapsLink } from '../lib/geo'
import type { Report } from '../lib/types'
import { SeverityBadge, StatusBadge, StatusTrack } from './Badges'
import { Lightbox } from './Lightbox'
import { ShareButton } from './ShareButton'

export function PhotoStrip({ report, tall }: { report: Report; tall?: boolean }) {
  const [active, setActive] = useState(0)
  const [viewing, setViewing] = useState<number | null>(null)
  const images = report.photos.map((p, i) => ({ src: p.url, alt: `Foto ${i + 1} del hueco` }))
  return (
    <div className="relative">
      <div
        className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
        onScroll={(e) => {
          const el = e.currentTarget
          setActive(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {report.photos.map((p, i) => (
          <button
            key={p.path}
            type="button"
            onClick={() => setViewing(i)}
            className="group relative w-full shrink-0 snap-center cursor-zoom-in"
            aria-label={`Ampliar foto ${i + 1}`}
          >
            <img
              src={p.url}
              alt={`Foto ${i + 1} del hueco`}
              className={`w-full bg-cream-200 object-cover ${tall ? 'h-72' : 'h-56'}`}
              loading="lazy"
            />
            <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink shadow-soft backdrop-blur transition group-hover:scale-110">
              <Expand className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
      {report.photos.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-white/80 px-2 py-1.5 backdrop-blur">
          {report.photos.map((p, i) => (
            <span
              key={p.path}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-coral' : 'w-1.5 bg-ink-faint'}`}
            />
          ))}
        </div>
      )}
      <Lightbox images={images} startIndex={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

export function ReportDetail({ report, actions, tallPhotos }: { report: Report; actions?: ReactNode; tallPhotos?: boolean }) {
  return (
    <div>
      <div className="px-4">
        <div className="overflow-hidden rounded-[24px]">
          <PhotoStrip report={report} tall={tallPhotos} />
        </div>
      </div>

      <div className="space-y-4 px-5 pb-6 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={report.status} />
          <SeverityBadge severity={report.severity} />
          <span className="ml-auto text-xs font-medium text-ink-muted" title={formatDate(report.createdAt)}>
            {timeAgo(report.createdAt)}
          </span>
        </div>

        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-coral-soft text-coral-deep">
            <MapPin className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-medium leading-snug text-ink">
              {report.address ?? 'Ubicación marcada en el mapa'}
            </p>
            <p className="tabular text-xs text-ink-muted">{formatCoords(report)}</p>
          </div>
        </div>

        {report.note && (
          <p className="rounded-2xl bg-lavender-soft px-4 py-3 text-sm text-ink-soft">
            <span className="mr-1 font-display text-lg leading-none text-lavender-deep">“</span>
            {report.note}
          </p>
        )}

        <div className="rounded-2xl bg-white p-4 shadow-card">
          <StatusTrack status={report.status} />
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <Users className="h-4 w-4 text-ink-muted" />
            {report.confirmations > 0 ? (
              <span>
                <b className="text-ink">{report.confirmations}</b>{' '}
                {report.confirmations === 1 ? 'vecino confirmó' : 'vecinos confirmaron'} que sigue ahí
              </span>
            ) : (
              <span>Aún nadie más lo confirmó</span>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          {actions}
          <div className="grid grid-cols-2 gap-2">
            <ShareButton report={report} className="btn-soft px-3" />
            <a href={googleMapsLink(report)} target="_blank" rel="noreferrer" className="btn-soft px-3">
              <Navigation className="h-4 w-4" />
              Cómo llegar
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

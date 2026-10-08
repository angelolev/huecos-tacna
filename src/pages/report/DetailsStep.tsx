import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, LoaderCircle, MapPin, Send } from 'lucide-react'
import { formatCoords } from '../../lib/geo'
import { haptic } from '../../lib/fx'
import { SEVERITIES, SEVERITY_META } from '../../lib/types'
import type { LatLng, Severity } from '../../lib/types'
import type { PhotoItem } from './PhotosStep'
import { Lightbox } from '../../components/Lightbox'

const NOTE_MAX = 280
const QUICK_TAGS = ['💧 Se llena de agua', '🏫 Cerca a un colegio', '🚗 Ocupa todo el carril', '🌙 De noche no se ve', '🚲 Peligroso para motos']

export function DetailsStep({
  photos,
  location,
  address,
  severity,
  note,
  onSeverity,
  onNote,
  onSubmit,
  progress,
  error,
}: {
  photos: PhotoItem[]
  location: LatLng
  address: string | null
  severity: Severity
  note: string
  onSeverity: (s: Severity) => void
  onNote: (n: string) => void
  onSubmit: () => void
  progress: number | null
  error: string | null
}) {
  const sending = progress !== null
  const [viewing, setViewing] = useState<number | null>(null)

  const toggleTag = (tag: string) => {
    haptic(6)
    const text = tag.replace(/^\S+\s/, '')
    if (note.includes(text)) {
      onNote(
        note
          .replace(text, '')
          .replace(/(^[\s,.]+|[\s,]+$)/g, '')
          .replace(/,\s*,/g, ','),
      )
    } else {
      onNote((note.trim() ? `${note.trim().replace(/[.,]$/, '')}, ${text.toLowerCase()}` : text).slice(0, NOTE_MAX))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-4">
      <h1 className="title">
        ¿Qué tan <span className="text-coral-deep">grande</span> es?
      </h1>

      <div className="mt-5 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Severidad">
        {SEVERITIES.map((s) => {
          const meta = SEVERITY_META[s]
          const active = s === severity
          return (
            <motion.button
              key={s}
              role="radio"
              aria-checked={active}
              whileTap={{ scale: 0.92 }}
              animate={{ y: active ? -4 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={() => {
                haptic(10)
                onSeverity(s)
              }}
              disabled={sending}
              className="relative flex flex-col items-center gap-1 rounded-[24px] border-[3px] px-2 pb-3 pt-4 text-center transition-colors"
              style={{
                background: active ? meta.soft : '#FFFFFF',
                borderColor: active ? meta.color : '#F0E5DA',
                boxShadow: active ? `0 10px 24px -12px ${meta.color}` : undefined,
              }}
            >
              {active && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full border-[3px] border-white"
                  style={{ background: meta.color }}
                >
                  <Check className="h-3.5 w-3.5 text-ink" strokeWidth={3} />
                </motion.span>
              )}
              <motion.span
                key={active ? 'on' : 'off'}
                className="text-[40px] leading-none"
                animate={active ? { rotate: [0, -14, 12, -6, 0], scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5 }}
                aria-hidden
              >
                {meta.emoji}
              </motion.span>
              <span className="font-display text-base font-semibold" style={{ color: active ? meta.deep : '#2F2B3A' }}>
                {meta.label}
              </span>
              <span className="text-[11px] leading-tight text-ink-muted">{meta.hint}</span>
            </motion.button>
          )
        })}
      </div>

      <div className="mt-7">
        <p className="mb-2 flex items-baseline justify-between font-display text-lg font-medium text-ink">
          ¿Algo más? <span className="font-body text-xs font-normal text-ink-muted">opcional</span>
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_TAGS.map((tag) => {
            const on = note.includes(tag.replace(/^\S+\s/, ''))
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                disabled={sending}
                className={`chip ${on ? 'border-lavender bg-lavender-soft text-lavender-deep' : 'border-line bg-white text-ink-soft'}`}
              >
                {tag}
              </button>
            )
          })}
        </div>
        <textarea
          value={note}
          onChange={(e) => onNote(e.target.value.slice(0, NOTE_MAX))}
          disabled={sending}
          rows={2}
          placeholder="Ej: frente al mercado Grau…"
          className="field resize-none"
        />
        <span className="mt-1 block text-right text-xs tabular text-ink-faint">
          {note.length}/{NOTE_MAX}
        </span>
      </div>

      <div className="card mt-3 flex items-center gap-3 p-3">
        <div className="flex -space-x-5">
          {photos.map((p, i) => (
            <motion.button
              key={p.preview}
              type="button"
              whileTap={{ scale: 0.9 }}
              whileHover={{ y: -3 }}
              onClick={() => setViewing(i)}
              className="relative cursor-zoom-in"
              style={{ zIndex: 2 - i, rotate: i ? 6 : -4 }}
              aria-label={`Ampliar foto ${i + 1}`}
            >
              <img src={p.preview} alt="" className="h-14 w-14 rounded-2xl border-[3px] border-white object-cover shadow-soft" />
            </motion.button>
          ))}
        </div>
        <div className="min-w-0 flex-1 pl-1">
          <p className="flex items-center gap-1 text-sm font-semibold text-ink">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-coral-deep" />
            <span className="truncate">{address ?? 'Punto en el mapa'}</span>
          </p>
          <p className="tabular text-xs text-ink-muted">{formatCoords(location)}</p>
        </div>
      </div>

      <Lightbox
        images={photos.map((p, i) => ({ src: p.preview, alt: `Tu foto ${i + 1}` }))}
        startIndex={viewing}
        onClose={() => setViewing(null)}
      />

      {error && <p className="mt-3 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral-deep">{error}</p>}

      <div className="mt-auto pt-6">
        <button className="btn-primary w-full overflow-hidden text-xl" onClick={() => !sending && onSubmit()} aria-busy={sending}>
          {sending && (
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-white/35 transition-all"
              style={{ width: `${Math.max(8, Math.round(progress * 100))}%` }}
            />
          )}
          <span className="relative flex items-center gap-2">
            {sending ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" />
                {progress < 1 ? `Subiendo fotos… ${Math.round(progress * 100)}%` : 'Guardando…'}
              </>
            ) : (
              <>
                <Send className="h-5 w-5" /> Enviar reporte
              </>
            )}
          </span>
        </button>
      </div>
    </div>
  )
}

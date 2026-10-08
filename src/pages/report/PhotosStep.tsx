import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, ImagePlus, LoaderCircle, X } from 'lucide-react'
import { compressImage } from '../../lib/image'
import { Lightbox } from '../../components/Lightbox'
import { haptic } from '../../lib/fx'

export interface PhotoItem {
  blob: Blob
  preview: string
}

const SLOTS = [
  { title: 'De cerca', hint: 'Que se vea el tamaño', emoji: '🔍', tilt: -3, tone: 'bg-coral-soft' },
  { title: 'Con referencia', hint: 'Opcional · la calle o una fachada', emoji: '🏘️', tilt: 3, tone: 'bg-lavender-soft' },
]

export function PhotosStep({
  photos,
  onChange,
}: {
  photos: PhotoItem[]
  onChange: (photos: PhotoItem[]) => void
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const full = photos.length >= 2

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    const room = 2 - photos.length
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room)
    if (files.length > room) setError('Máximo 2 fotos por reporte.')
    setProcessing(picked.length)
    const added: PhotoItem[] = []
    for (const file of picked) {
      try {
        const blob = await compressImage(file)
        added.push({ blob, preview: URL.createObjectURL(blob) })
      } catch {
        setError('No pudimos leer una de las fotos. Prueba con otra.')
      }
      setProcessing((n) => n - 1)
    }
    if (added.length) haptic([10, 30, 10])
    onChange([...photos, ...added])
  }

  const remove = (i: number) => {
    haptic(8)
    URL.revokeObjectURL(photos[i].preview)
    onChange(photos.filter((_, idx) => idx !== i))
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-4">
      <h1 className="title">
        Toma una foto <span className="text-coral-deep">del hueco</span> 📸
      </h1>
      <p className="mt-2 text-ink-muted">Hasta 2 fotos. Las achicamos para que suban rápido con tus datos.</p>

      <div className="mt-7 grid grid-cols-2 gap-4">
        {SLOTS.map((slot, i) => {
          const photo = photos[i]
          const isProcessing = !photo && i < photos.length + processing
          const locked = !photo && i > photos.length
          return (
            <div key={slot.title} className="relative aspect-[3/4]">
              <AnimatePresence mode="popLayout" initial={false}>
                {photo ? (
                  <motion.div
                    key={photo.preview}
                    initial={{ scale: 0.4, rotate: slot.tilt * 4, opacity: 0 }}
                    animate={{ scale: 1, rotate: slot.tilt, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="absolute inset-0 rounded-[22px] bg-white p-2 pb-9 shadow-float"
                  >
                    <button
                      type="button"
                      onClick={() => setViewing(i)}
                      className="h-full w-full cursor-zoom-in"
                      aria-label={`Ampliar foto ${i + 1}`}
                    >
                      <img src={photo.preview} alt={slot.title} className="h-full w-full rounded-[16px] object-cover" />
                    </button>
                    <span className="absolute inset-x-0 bottom-2 text-center font-display text-sm font-medium text-ink-soft">
                      {slot.emoji} {slot.title}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => remove(i)}
                      className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-ink text-white shadow-soft"
                      aria-label="Quitar foto"
                    >
                      <X className="h-4 w-4" />
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: locked ? 0.45 : 1, y: 0 }}
                    transition={{ delay: 0.06 * i }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => cameraRef.current?.click()}
                    disabled={full || isProcessing || locked}
                    className={`absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[22px] border-[3px] border-dashed border-white p-3 text-center ${slot.tone}`}
                  >
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-soft">
                      {isProcessing ? (
                        <LoaderCircle className="h-6 w-6 animate-spin text-coral-deep" />
                      ) : (
                        <Camera className="h-6 w-6 text-ink-soft" />
                      )}
                    </span>
                    <span className="font-display text-lg font-medium leading-tight text-ink">{slot.title}</span>
                    <span className="text-xs leading-tight text-ink-muted">{slot.hint}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      <Lightbox
        images={photos.map((p, i) => ({ src: p.preview, alt: SLOTS[i]?.title ?? `Foto ${i + 1}` }))}
        startIndex={viewing}
        onClose={() => setViewing(null)}
      />

      {error && <p className="mt-4 rounded-2xl bg-coral-soft px-4 py-2 text-sm text-coral-deep">{error}</p>}

      <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
        <button className="btn-soft" onClick={() => cameraRef.current?.click()} disabled={full || processing > 0}>
          <Camera className="h-5 w-5 text-coral-deep" /> Cámara
        </button>
        <button className="btn-soft" onClick={() => galleryRef.current?.click()} disabled={full || processing > 0}>
          <ImagePlus className="h-5 w-5 text-lavender-deep" /> Galería
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

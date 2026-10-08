import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { haptic } from '../lib/fx'

export interface LightboxImage {
  src: string
  alt: string
}

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : dir < 0 ? '-100%' : 0, opacity: 0, scale: dir === 0 ? 0.92 : 1 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
}

/**
 * Visor de fotos a pantalla completa. Se cierra con la X, tocando el fondo, Esc o deslizando hacia abajo;
 * con varias fotos se navega con flechas, teclado o deslizando a los lados.
 */
export function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: LightboxImage[]
  /** Índice de la foto a mostrar; `null` = cerrado. */
  startIndex: number | null
  onClose: () => void
}) {
  const open = startIndex !== null && images.length > 0
  const [[index, dir], setPage] = useState<[number, number]>([0, 0])
  const many = images.length > 1

  useEffect(() => {
    if (startIndex !== null) setPage([startIndex, 0])
  }, [startIndex])

  const go = (step: number) => {
    if (!many) return
    haptic(6)
    setPage(([i]) => [(i + step + images.length) % images.length, step])
  }

  useEffect(() => {
    if (!open) return
    // En captura y deteniendo la propagación: Esc cierra solo el visor, no la hoja que está debajo.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else return
      e.stopPropagation()
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
    }
  }, [open, images.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Precarga las fotos vecinas para que el carrusel no parpadee.
  useEffect(() => {
    if (!open || !many) return
    ;[index + 1, index - 1].forEach((i) => {
      const img = new Image()
      img.src = images[(i + images.length) % images.length].src
    })
  }, [open, index, many, images])

  const current = images[Math.min(index, images.length - 1)]

  return createPortal(
    <AnimatePresence>
      {open && current && (
        <motion.div
          key="lightbox"
          role="dialog"
          aria-modal
          aria-label="Foto ampliada"
          className="fixed inset-0 z-[90] flex flex-col bg-ink/95 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Barra superior */}
          <div className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold tabular text-white">
              {many ? `${index + 1} / ${images.length}` : 'Foto'}
            </span>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              aria-label="Cerrar foto"
            >
              <X className="h-5 w-5" />
            </motion.button>
          </div>

          {/* Foto */}
          <div className="relative min-h-0 flex-1 overflow-hidden" onClick={onClose}>
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.img
                key={current.src}
                src={current.src}
                alt={current.alt}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                drag
                dragDirectionLock
                dragSnapToOrigin
                dragElastic={0.6}
                onDragEnd={(_, info) => {
                  const { offset, velocity } = info
                  if (Math.abs(offset.y) > Math.abs(offset.x)) {
                    if (offset.y > 110 || velocity.y > 700) onClose()
                  } else if (offset.x < -70 || velocity.x < -500) go(1)
                  else if (offset.x > 70 || velocity.x > 500) go(-1)
                }}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
                className="absolute inset-0 m-auto max-h-full max-w-full touch-none select-none object-contain p-3 sm:p-8"
              />
            </AnimatePresence>

            {many && (
              <>
                <ArrowButton side="left" onClick={() => go(-1)} />
                <ArrowButton side="right" onClick={() => go(1)} />
              </>
            )}
          </div>

          {/* Miniaturas */}
          {many && (
            <div className="relative z-10 flex justify-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
              {images.map((img, i) => (
                <button
                  key={img.src}
                  onClick={() => i !== index && setPage([i, i > index ? 1 : -1])}
                  className={`h-14 w-14 overflow-hidden rounded-2xl border-[3px] transition ${
                    i === index ? 'scale-105 border-coral' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                  aria-label={`Ver foto ${i + 1}`}
                >
                  <img src={img.src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {!many && <div className="pb-[calc(env(safe-area-inset-bottom)+1rem)]" />}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function ArrowButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`absolute top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
      aria-label={side === 'left' ? 'Foto anterior' : 'Foto siguiente'}
    >
      <Icon className="h-6 w-6" />
    </motion.button>
  )
}

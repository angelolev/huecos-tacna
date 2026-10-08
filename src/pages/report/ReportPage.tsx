import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Clock, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCities } from '../../context/CitiesContext'
import { haptic } from '../../lib/fx'
import { useGeoWatch } from '../../hooks/useGeoWatch'
import { useDocumentMeta } from '../../hooks/useDocumentMeta'
import { confirmReport, createReport, findNearby, hasConfirmed, secondsUntilCanReport, withTimeout } from '../../lib/reports'
import type { LatLng, Severity } from '../../lib/types'
import { PhotosStep } from './PhotosStep'
import type { PhotoItem } from './PhotosStep'
import { LocationStep } from './LocationStep'
import { DetailsStep } from './DetailsStep'
import { DuplicateSheet } from './DuplicateSheet'
import type { NearbyReport } from './DuplicateSheet'
import { SuccessView } from './SuccessView'

type Step = 0 | 1 | 2
const STEPS = [
  { label: 'Fotos', emoji: '📸' },
  { label: 'Lugar', emoji: '📍' },
  { label: 'Detalles', emoji: '✏️' },
]

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-40%' : '40%', opacity: 0 }),
}

export default function ReportPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { enabledCityFor } = useCities()
  useDocumentMeta({
    title: 'Reportar un hueco',
    description: 'Reporta un hueco en la pista en 30 segundos: toma una foto, marca la ubicación y envíalo, sin registrarte.',
    path: '/reportar',
  })

  const [step, setStep] = useState<Step>(0)
  const [dir, setDir] = useState(1)
  const goTo = (next: Step) => {
    setDir(next > step ? 1 : -1)
    setStep(next)
  }
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [location, setLocation] = useState<LatLng | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [severity, setSeverity] = useState<Severity>('mediano')
  const [note, setNote] = useState('')

  const [checking, setChecking] = useState(false)
  const [candidates, setCandidates] = useState<NearbyReport[]>([])
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ id: string; kind: 'created' | 'confirmed'; address: string | null; severity: Severity } | null>(null)
  const [wait, setWait] = useState(0)

  // Si el permiso de ubicación ya está concedido, encendemos el GPS desde el paso de fotos
  // para que al llegar al mapa ya tenga una lectura precisa (el GPS tarda unos segundos en afinar).
  const [geoGranted, setGeoGranted] = useState(false)
  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((p) => setGeoGranted(p.state === 'granted'))
      .catch(() => {})
  }, [])
  const geo = useGeoWatch(!done && (geoGranted || step >= 1))

  // Límite de 1 reporte cada 2 minutos: avisamos desde el inicio.
  useEffect(() => {
    if (!user) return
    secondsUntilCanReport(user.uid).then(setWait).catch(() => setWait(0))
  }, [user, done])

  useEffect(() => {
    if (wait <= 0) return
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000)
    return () => clearInterval(t)
  }, [wait > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // Liberamos las previsualizaciones al salir.
  const photosRef = useRef(photos)
  photosRef.current = photos
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), [])

  const onLocation = useCallback((l: LatLng) => setLocation(l), [])

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.preview))
    setPhotos([])
    setLocation(null)
    setAddress(null)
    setSeverity('mediano')
    setNote('')
    setError(null)
    setProgress(null)
    setDone(null)
    setDir(-1)
    setStep(0)
  }

  const confirmLocation = async () => {
    if (!location) return
    setChecking(true)
    try {
      // Con mala señal no dejamos al usuario esperando: tras 6 s seguimos sin revisar duplicados.
      const nearby = await withTimeout(findNearby(location), 6000)
      if (nearby.length) setCandidates(nearby)
      else goTo(2)
    } catch (err) {
      console.error(err)
      goTo(2) // si falla la búsqueda, no bloqueamos el reporte
    } finally {
      setChecking(false)
    }
  }

  const pickDuplicate = async (r: NearbyReport) => {
    if (!user) return
    try {
      if (r.reporterUid !== user.uid && !(await hasConfirmed(r.id, user.uid))) {
        await confirmReport(r.id, user.uid)
      }
      setCandidates([])
      setDone({ id: r.id, kind: 'confirmed', address: r.address, severity: r.severity })
    } catch (err) {
      console.error(err)
      setCandidates([])
      setError('No se pudo confirmar el reporte existente. Puedes enviar uno nuevo.')
      goTo(2)
    }
  }

  const submit = async () => {
    if (!user || !location) return
    setError(null)
    const city = enabledCityFor(location)
    if (!city) {
      setError('Huecazo aún no funciona en esta zona. Vuelve al paso anterior y revisa la ubicación.')
      return
    }
    const remaining = await withTimeout(secondsUntilCanReport(user.uid), 5000).catch(() => 0)
    if (remaining > 0) {
      setWait(remaining)
      setError(`Para evitar spam, espera ${remaining} s antes de enviar otro reporte.`)
      return
    }
    setProgress(0)
    try {
      const id = await createReport({
        uid: user.uid,
        cityId: city.id,
        location,
        photos: photos.map((p) => p.blob),
        severity,
        note,
        address,
        onProgress: setProgress,
      })
      setDone({ id, kind: 'created', address, severity })
    } catch (err) {
      console.error(err)
      setError('No se pudo enviar el reporte. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setProgress(null)
    }
  }

  const back = () => {
    haptic(6)
    if (step === 0) navigate('/')
    else goTo((step - 1) as Step)
  }

  const stepContent =
    step === 0 ? (
      <>
        <PhotosStep photos={photos} onChange={setPhotos} />
        <div className="mx-auto w-full max-w-lg px-5 pb-safe-4">
          <button
            className="btn-primary w-full text-xl"
            disabled={!photos.length}
            onClick={() => {
              haptic(12)
              goTo(1)
            }}
          >
            Siguiente <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </>
    ) : step === 1 ? (
      <LocationStep
        geo={geo}
        location={location}
        address={address}
        onLocation={onLocation}
        onAddress={setAddress}
        onConfirm={confirmLocation}
        checking={checking}
      />
    ) : (
      location && (
        <DetailsStep
          photos={photos}
          location={location}
          address={address}
          severity={severity}
          note={note}
          onSeverity={setSeverity}
          onNote={setNote}
          onSubmit={submit}
          progress={progress}
          error={error}
        />
      )
    )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-blobs">
      {!done && (
        <header className="relative z-20 shrink-0 pt-safe">
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pb-3 pt-3">
            <motion.button whileTap={{ scale: 0.85 }} onClick={back} className="icon-btn" aria-label={step === 0 ? 'Cerrar' : 'Atrás'}>
              {step === 0 ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </motion.button>
            <ol className="flex flex-1 items-center gap-1.5 rounded-full bg-white p-1.5 shadow-soft">
              {STEPS.map((st, i) => {
                const current = i === step
                const passed = i < step
                return (
                  <motion.li
                    key={st.label}
                    layout
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-full text-sm font-semibold ${
                      current ? 'flex-[2] bg-coral text-ink' : passed ? 'flex-1 bg-mint-soft text-mint-deep' : 'flex-1 text-ink-faint'
                    }`}
                  >
                    <span aria-hidden>{passed ? '✓' : st.emoji}</span>
                    {current && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
                        {st.label}
                      </motion.span>
                    )}
                  </motion.li>
                )
              })}
            </ol>
          </div>
          <AnimatePresence>
            {wait > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mx-auto max-w-lg overflow-hidden px-4"
              >
                <p className="mb-2 flex items-center gap-2 rounded-2xl bg-butter-soft px-3 py-2 text-xs font-medium text-butter-deep">
                  <Clock className="h-4 w-4" /> Podrás enviar otro reporte en {wait} s. Mientras, puedes ir avanzando.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
      )}

      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {done ? (
          <SuccessView report={done} kind={done.kind} onAnother={reset} />
        ) : (
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="flex min-h-full flex-1 flex-col pt-2"
            >
              {stepContent}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <DuplicateSheet
        candidates={candidates}
        onPick={pickDuplicate}
        onDismiss={() => {
          setCandidates([])
          goTo(2)
        }}
        onClose={() => setCandidates([])}
      />
    </div>
  )
}

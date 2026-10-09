import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Camera, ChevronDown, MapPin, PencilLine } from 'lucide-react'
import { PinMark } from '../components/Logo'
import { listCityNames, useCities } from '../context/CitiesContext'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useBack } from '../hooks/useBack'
import { STATUS_META } from '../lib/types'

const STEPS = [
  { Icon: Camera, tone: 'bg-coral-soft text-coral-deep', title: 'Toma una foto', text: 'Una o dos fotos del hueco: una de cerca y otra con alguna referencia de la calle.' },
  { Icon: MapPin, tone: 'bg-sky-soft text-sky-deep', title: 'Marca dónde está', text: 'El mapa se ubica solo con tu GPS. Mueve el pin hasta que quede justo sobre el hueco.' },
  { Icon: PencilLine, tone: 'bg-lavender-soft text-lavender-deep', title: 'Envía tu reporte', text: 'Elige qué tan grave es y, si quieres, agrega una nota. Aparece en el mapa al instante.' },
]

function faqs(cities: string) {
  return [
    {
      q: '¿Necesito crear una cuenta para reportar?',
      a: 'No. Puedes reportar sin registrarte. Si quieres conservar tus reportes al cambiar de celular, puedes vincular tu cuenta de Google cuando quieras.',
    },
    { q: '¿Es gratis?', a: 'Sí, Huecazo es gratuito para todos los vecinos.' },
    {
      q: '¿En qué ciudades funciona?',
      a: `Hoy recibimos reportes en ${cities}. Estamos preparando la llegada a más ciudades del Perú.`,
    },
    {
      q: '¿Qué pasa si el hueco ya fue reportado?',
      a: 'Si alguien ya lo reportó a menos de 25 metros, Huecazo te lo muestra para que lo confirmes en lugar de duplicarlo. Mientras más vecinos lo confirman, más prioridad tiene.',
    },
    {
      q: '¿Quién ve mis reportes?',
      a: 'Los reportes (foto, ubicación y nota) se muestran en el mapa público para que todos los vecinos los vean. No mostramos tu nombre ni tu correo.',
    },
    {
      q: '¿Cómo sé si ya lo repararon?',
      a: 'Cada reporte pasa por tres estados: reportado, verificado y reparado. Puedes seguirlos en "Mis reportes".',
    },
    {
      q: '¿Puedo instalarlo en mi celular?',
      a: 'Sí. Abre huecazo.com en tu celular y elige "Agregar a la pantalla de inicio". Funciona como una app, sin pasar por la tienda.',
    },
  ]
}

export default function AboutPage() {
  const { enabledCities } = useCities()
  const cities = listCityNames(enabledCities) || 'Tacna'
  const items = useMemo(() => faqs(cities), [cities])

  const jsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }),
    [items],
  )

  useDocumentMeta({
    title: '¿Qué es Huecazo? Cómo reportar huecos en las pistas',
    description: `Huecazo es el mapa ciudadano de huecos en las pistas. Reporta en 30 segundos con foto y ubicación, sin registrarte. Disponible en ${cities}.`,
    path: '/acerca',
    jsonLd,
  })
  const back = useBack()

  return (
    <div className="min-h-dvh bg-blobs pb-safe-4">
      <header className="sticky top-0 z-10 pt-safe">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button onClick={back} className="icon-btn" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-10">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="pt-2 text-center">
          <PinMark size={52} className="mx-auto animate-floaty" />
          <h1 className="title mt-4 text-[38px]">
            Huec<span className="text-coral-deep">azo</span>: el mapa ciudadano de huecos
          </h1>
          <p className="mx-auto mt-3 max-w-md text-lg text-ink-soft">
            ¿Viste un hueco en la pista? Repórtalo en 30 segundos con una foto y tu ubicación, sin registrarte. Juntos
            hacemos visibles los huecos de la ciudad para que los reparen antes.
          </p>
          <p className="mt-3 inline-flex rounded-full bg-mint-soft px-4 py-1.5 text-sm font-semibold text-mint-deep">
            📍 Disponible en {cities}
          </p>
          <div className="mt-6">
            <Link to="/reportar" className="btn-primary text-xl">
              <Camera className="h-6 w-6" /> Reportar un hueco
            </Link>
          </div>
        </motion.section>

        <section className="mt-12" aria-labelledby="como">
          <h2 id="como" className="font-display text-2xl font-semibold text-ink">
            Cómo reportar un hueco
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {STEPS.map(({ Icon, tone, title, text }, i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="card p-5"
              >
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold">
                  {i + 1}. {title}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">{text}</p>
              </motion.li>
            ))}
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="estados">
          <h2 id="estados" className="font-display text-2xl font-semibold text-ink">
            ¿Qué pasa con mi reporte?
          </h2>
          <p className="mt-2 text-ink-soft">
            Tu reporte aparece en el mapa público y los vecinos pueden confirmar que el hueco sigue ahí. Cada reporte avanza
            por tres estados:
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(['pendiente', 'verificado', 'reparado'] as const).map((s, i) => (
              <span
                key={s}
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{ background: STATUS_META[s].soft, color: STATUS_META[s].deep }}
              >
                {i + 1}. {STATUS_META[s].label}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="faq">
          <h2 id="faq" className="font-display text-2xl font-semibold text-ink">
            Preguntas frecuentes
          </h2>
          <div className="mt-4 space-y-2">
            {items.map((f) => (
              <details key={f.q} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 font-semibold text-ink">
                  <span className="flex-1">{f.q}</span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-4 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="card mt-12 p-6 text-center">
          <p className="font-display text-2xl font-semibold">¿Viste un hueco hoy? 🚧</p>
          <p className="mt-1 text-ink-soft">Repórtalo ahora: te toma menos de un minuto.</p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/reportar" className="btn-primary">
              <Camera className="h-5 w-5" /> Reportar un hueco
            </Link>
            <button onClick={back} className="btn-soft">
              <MapPin className="h-4 w-4" /> Ver el mapa
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

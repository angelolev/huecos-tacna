import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useBack } from '../hooks/useBack'

const CONTACT_EMAIL = 'angelo@codinglatam.dev'
const OWNER = 'Coding Latam'
const LAST_UPDATED = '12 de octubre de 2026'

interface Section {
  id: string
  title: string
  body: ReactNode
}

const SECTIONS: Section[] = [
  {
    id: 'responsable',
    title: '¿Quién es responsable de tus datos?',
    body: (
      <p>
        Huecazo (huecazo.com) es un proyecto de <strong>{OWNER}</strong>, responsable del tratamiento de los datos
        personales que se recogen en la app, de acuerdo con la Ley N.º 29733, Ley de Protección de Datos Personales del
        Perú, y su reglamento. Para cualquier consulta escríbenos a{' '}
        <a className="font-semibold text-coral-deep underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    ),
  },
  {
    id: 'datos',
    title: '¿Qué datos recogemos?',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Tus reportes:</strong> las fotos del hueco, su ubicación en el mapa, la gravedad, la dirección aproximada
          y la nota que escribas. <strong>Son públicos</strong>: cualquier persona los ve en el mapa.
        </li>
        <li>
          <strong>Tus confirmaciones:</strong> cuando confirmas un hueco guardamos la fecha y una posición redondeada cerca
          del hueco, para comprobar que estabas cerca.
        </li>
        <li>
          <strong>Tu cuenta:</strong> por defecto entras como anónimo, sin nombre ni correo. Si vinculas tu cuenta de
          Google, Firebase guarda tu correo para que puedas volver a entrar; nunca lo mostramos.
        </li>
        <li>
          <strong>Tu alias:</strong> si ganas puntos, te asignamos al azar un alias con un emoji (por ejemplo 🦊
          ZorroAstuto427) para el ranking. Nunca mostramos tu nombre real.
        </li>
        <li>
          <strong>Tu ubicación:</strong> usamos el GPS del celular, solo con tu permiso, para centrar el mapa y ubicar el
          hueco. Si no lo das, estimamos tu ciudad a partir de tu dirección IP. Si pides que Huecazo llegue a tu ciudad,
          guardamos ese lugar.
        </li>
        <li>
          <strong>Visitas:</strong> con Google Analytics contamos visitas de forma agregada (páginas vistas, ciudad
          aproximada, tipo de dispositivo). No lo usamos para publicidad.
        </li>
      </ul>
    ),
  },
  {
    id: 'ia',
    title: 'Revisión de fotos con inteligencia artificial',
    body: (
      <>
        <p>
          Antes de publicar una foto, enviamos una copia reducida a <strong>Anthropic</strong> (el servicio de IA Claude)
          para comprobar automáticamente que muestre una pista o vereda y que no tenga contenido inapropiado. Así evitamos
          que el mapa se llene de fotos que no tienen nada que ver con huecos.
        </p>
        <p className="mt-2">
          Solo enviamos la foto, sin tu nombre, tu correo ni tu ubicación. Según sus condiciones comerciales, Anthropic no
          usa estas fotos para entrenar sus modelos. Si la revisión se equivoca y rechaza una foto válida, escríbenos.
        </p>
      </>
    ),
  },
  {
    id: 'para-que',
    title: '¿Para qué usamos tus datos?',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Mostrar los huecos en el mapa público y su estado (reportado, verificado, reparado).</li>
        <li>Evitar reportes duplicados, falsos o abusivos, y calcular los puntos y el ranking de vecinos.</li>
        <li>Compartir los reportes, que ya son públicos, con municipalidades y autoridades para que prioricen las reparaciones.</li>
        <li>Saber en qué ciudades se usa Huecazo y mejorar la app.</li>
      </ul>
    ),
  },
  {
    id: 'proveedores',
    title: '¿Con quién compartimos tus datos?',
    body: (
      <>
        <p>No vendemos tus datos. Para que Huecazo funcione usamos estos proveedores, que pueden procesar datos fuera del Perú:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Google</strong> (Firebase, Google Maps y Google Analytics): base de datos, fotos, inicio de sesión, mapas
            y estadísticas de visitas.
          </li>
          <li>
            <strong>Vercel</strong>: alojamiento de la página web.
          </li>
          <li>
            <strong>Anthropic</strong>: revisión automática de las fotos.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'conservacion',
    title: '¿Cuánto tiempo guardamos tus datos?',
    body: (
      <p>
        Los reportes se mantienen en el mapa mientras sean útiles para la ciudad, incluso después de que el hueco se
        repare, como registro histórico. Los administradores eliminan los reportes falsos o inapropiados. Puedes pedirnos
        que borremos tus reportes en cualquier momento.
      </p>
    ),
  },
  {
    id: 'derechos',
    title: 'Tus derechos',
    body: (
      <p>
        Puedes pedirnos acceder a tus datos, corregirlos, eliminarlos u oponerte a su uso (derechos ARCO). Escríbenos a{' '}
        <a className="font-semibold text-coral-deep underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>{' '}
        con el enlace de tus reportes (ábrelos desde "Mis reportes" y toca Compartir) y te responderemos dentro de los plazos
        que establece la ley. Si no quedas conforme, puedes acudir a la Autoridad Nacional de Protección de Datos
        Personales del Ministerio de Justicia y Derechos Humanos.
      </p>
    ),
  },
  {
    id: 'menores',
    title: 'Menores de edad',
    body: (
      <p>
        Huecazo está pensado para mayores de 14 años. Si eres menor, pide a tu madre, padre o apoderado que te acompañe al
        usar la app. No publiques fotos en las que se reconozca a personas.
      </p>
    ),
  },
  {
    id: 'cambios',
    title: 'Cambios en esta política',
    body: (
      <p>
        Si cambiamos cómo usamos tus datos, actualizaremos esta página y la fecha de abajo. Si el cambio es importante, lo
        avisaremos dentro de la app.
      </p>
    ),
  },
]

export default function PrivacyPage() {
  useDocumentMeta({
    title: 'Política de privacidad',
    description: 'Qué datos recoge Huecazo, para qué los usa, con quién los comparte y cómo pedir que los borremos.',
    path: '/privacidad',
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
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-soft text-mint-deep">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <h1 className="title mt-4 text-[34px]">Política de privacidad</h1>
          <p className="mx-auto mt-3 max-w-md text-ink-soft">
            En corto: tus reportes son públicos, tu nombre y tu correo no. Revisamos las fotos con IA y nunca vendemos tus
            datos.
          </p>
        </motion.section>

        <div className="mt-10 space-y-4">
          {SECTIONS.map(({ id, title, body }) => (
            <section key={id} id={id} aria-labelledby={`${id}-title`} className="card p-5 text-ink-soft">
              <h2 id={`${id}-title`} className="mb-2 font-display text-xl font-semibold text-ink">
                {title}
              </h2>
              {body}
            </section>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-ink-muted">Última actualización: {LAST_UPDATED}</p>
      </main>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ExternalLink, Inbox, LoaderCircle, Plus, Power, Trash2, Users, X } from 'lucide-react'
import { useCities } from '../../context/CitiesContext'
import { deleteCityRequests, placeKey, subscribeCityRequests } from '../../lib/cityRequests'
import type { CityRequest } from '../../lib/cityRequests'
import { findCityFor, setCityEnabled } from '../../lib/cities'
import { googleMapsLink } from '../../lib/geo'
import { timeAgo } from '../../lib/format'
import { useBackClose } from '../../hooks/useBack'
import type { City, LatLng } from '../../lib/types'

const SEEN_KEY = 'huecazo:admin:city-requests-seen'

function readSeen() {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

/**
 * Pedidos de los vecinos para activar su ciudad, en vivo. `unseen` cuenta los que llegaron desde
 * la última vez que el admin abrió el panel de solicitudes (en este navegador).
 */
export function useCityRequests() {
  const [requests, setRequests] = useState<CityRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seenAt, setSeenAt] = useState(readSeen)

  useEffect(
    () =>
      subscribeCityRequests(setRequests, (e) => {
        console.error('No se pudieron cargar los pedidos de ciudades', e)
        setError('No se pudieron cargar los pedidos. ¿Están publicadas las reglas de Firestore?')
        setRequests([])
      }),
    [],
  )

  const unseen = (requests ?? []).filter((r) => (r.requestedAt?.getTime() ?? 0) > seenAt).length

  const markSeen = () => {
    const now = Date.now()
    try {
      localStorage.setItem(SEEN_KEY, String(now))
    } catch {
      /* sin almacenamiento: el aviso se reinicia al recargar */
    }
    setSeenAt(now)
  }

  return { requests: requests ?? [], loading: requests === null, error, unseen, seenAt, markSeen }
}

interface RequestGroup {
  key: string
  place: string
  region: string
  country: string
  requests: CityRequest[]
  /** Personas distintas que lo pidieron. */
  people: number
  last: Date | null
  center: LatLng
  /** Ciudad ya creada que cubre la zona (activa o pausada). */
  city: City | null
}

const COUNTRY = new Intl.DisplayNames(['es'], { type: 'region' })
const countryName = (code: string) => {
  try {
    return code ? (COUNTRY.of(code) ?? code) : ''
  } catch {
    return code
  }
}

/** Botón con contador de pedidos nuevos, para la barra del panel. */
export function CityRequestsButton({ unseen, onClick }: { unseen: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="icon-btn relative" title="Pedidos de ciudades" aria-label={`Pedidos de ciudades${unseen ? ` (${unseen} nuevos)` : ''}`}>
      <Inbox className="h-4 w-4" />
      {unseen > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-ink ring-2 ring-cream-50">
          {unseen > 99 ? '99+' : unseen}
        </span>
      )}
    </button>
  )
}

/** Lista de ciudades pedidas por los vecinos, agrupadas por lugar, con acciones para abrirlas. */
export function CityRequestsPanel({
  open,
  onClose,
  requests,
  loading,
  error,
  seenAt,
  onCreateCity,
}: {
  open: boolean
  onClose: () => void
  requests: CityRequest[]
  loading: boolean
  error: string | null
  /** Pedidos posteriores a esta fecha (ms) se marcan como nuevos. */
  seenAt: number
  /** Abre el editor de ciudades con el nombre ya escrito. */
  onCreateCity: (name: string) => void
}) {
  const { cities } = useCities()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useBackClose(open, onClose)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const groups = useMemo(() => {
    const byKey = new Map<string, CityRequest[]>()
    requests.forEach((r) => {
      const key = placeKey(r)
      byKey.set(key, [...(byKey.get(key) ?? []), r])
    })
    return [...byKey.entries()]
      .map(([key, list]): RequestGroup => {
        const center = {
          lat: list.reduce((s, r) => s + r.lat, 0) / list.length,
          lng: list.reduce((s, r) => s + r.lng, 0) / list.length,
        }
        return {
          key,
          place: list[0].place,
          // La región solo viene con el GPS (con la IP queda vacía).
          region: list.find((r) => r.region)?.region ?? '',
          country: list[0].country,
          requests: list,
          people: new Set(list.map((r) => r.uid)).size,
          last: list[0].requestedAt,
          center,
          city: findCityFor(center, cities),
        }
      })
      .sort((a, b) => b.people - a.people || (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0))
  }, [requests, cities])

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key)
    setErr(null)
    try {
      await action()
    } catch (e) {
      console.error(e)
      setErr(message)
    } finally {
      setBusy(null)
    }
  }

  const dismiss = (g: RequestGroup) => {
    if (!window.confirm(`¿Descartar ${g.requests.length === 1 ? 'el pedido' : `los ${g.requests.length} pedidos`} de ${g.place}?`)) return
    run(g.key, () => deleteCityRequests(g.requests.map((r) => r.id)), 'No se pudieron descartar los pedidos.')
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 backdrop-blur-[3px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal
          aria-label="Pedidos de ciudades"
        >
          <motion.div
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[32px] bg-cream-50 shadow-float sm:rounded-[32px]"
            initial={{ y: 40, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 pb-4 pt-5">
              <div className="flex-1">
                <p className="font-display text-2xl font-semibold leading-tight">Pedidos de ciudades</p>
                <p className="text-sm text-ink-muted">Vecinos que quieren Huecazo en su ciudad</p>
              </div>
              <button onClick={onClose} className="icon-btn h-10 w-10" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-6">
              {loading ? (
                <div className="grid place-items-center py-12">
                  <LoaderCircle className="h-6 w-6 animate-spin text-coral" />
                </div>
              ) : error ? (
                <p className="rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral-deep">{error}</p>
              ) : groups.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-muted">
                  <span className="mb-2 block text-3xl">📭</span>
                  Todavía nadie pidió activar otra ciudad.
                </p>
              ) : (
                groups.map((g) => {
                  const fresh = g.requests.filter((r) => (r.requestedAt?.getTime() ?? 0) > seenAt).length
                  const abroad = !!g.country && g.country !== 'PE'
                  return (
                    <div key={g.key} className="card space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-butter-soft font-display text-lg font-semibold text-butter-deep tabular">
                          {g.people}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-display text-lg font-medium leading-tight">
                            {g.place}
                            {fresh > 0 && (
                              <span className="rounded-full bg-coral px-2 py-0.5 font-body text-[11px] font-bold text-ink">
                                {fresh === 1 ? 'Nuevo' : `${fresh} nuevos`}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {[g.region, abroad ? countryName(g.country) : ''].filter(Boolean).join(' · ')}
                            {g.region || abroad ? ' · ' : ''}
                            <Users className="mb-0.5 inline h-3 w-3" /> {g.people} {g.people === 1 ? 'vecino' : 'vecinos'} · último{' '}
                            {timeAgo(g.last)}
                          </p>
                        </div>
                        <a
                          href={googleMapsLink(g.center)}
                          target="_blank"
                          rel="noreferrer"
                          className="icon-btn h-10 w-10 shadow-none ring-2 ring-line"
                          aria-label={`Ver ${g.place} en Google Maps`}
                          title="Ver en Google Maps"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {g.city?.enabled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-2 text-xs font-bold text-mint-deep">
                            <Check className="h-4 w-4" /> Ya activa ({g.city.name})
                          </span>
                        ) : g.city ? (
                          <button
                            onClick={() => run(g.key, () => setCityEnabled(g.city!.id, true), 'No se pudo activar la ciudad.')}
                            disabled={busy === g.key}
                            className="btn-soft px-4 py-2 text-sm"
                          >
                            {busy === g.key ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                            Activar {g.city.name}
                          </button>
                        ) : abroad ? (
                          <span className="rounded-full bg-cream-200 px-3 py-2 text-xs font-semibold text-ink-muted">Fuera del Perú</span>
                        ) : (
                          <button onClick={() => onCreateCity(g.place)} className="btn-soft px-4 py-2 text-sm">
                            <Plus className="h-4 w-4" /> Crear ciudad
                          </button>
                        )}
                        <button
                          onClick={() => dismiss(g)}
                          disabled={busy === g.key}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-ink-muted transition hover:text-coral-deep"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Descartar
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
              {err && <p className="rounded-2xl bg-coral-soft px-4 py-2 text-sm text-coral-deep">{err}</p>}
              {groups.length > 0 && (
                <p className="px-2 text-xs text-ink-muted">
                  <b>Crear ciudad</b> la agrega pausada: ajusta su zona y actívala cuando quieras abrirla. Una vez activa,
                  descarta sus pedidos.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

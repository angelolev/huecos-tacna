import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Gift, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCities } from '../../context/CitiesContext'
import { useBackClose } from '../../hooks/useBack'
import { usePrizes } from '../../hooks/usePrizes'
import { MAX_PRIZE_PLACE, deletePrize, monthKey, monthLabel, placeLabel, savePrize } from '../../lib/prizes'
import type { Prize } from '../../lib/prizes'
import { Header } from './CitiesManager'

type Mode = { kind: 'list' } | { kind: 'edit'; prize: Prize | null }

/** Panel para publicar los premios del ranking de cada mes y ciudad. */
export function PrizesManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const { enabledCities, cities } = useCities()
  const [cityId, setCityId] = useState('')
  // Este mes o el siguiente (para dejarlos listos antes de que empiece).
  const now = new Date()
  const months = [monthKey(now), monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1))]
  const [month, setMonth] = useState(months[0])
  useBackClose(open, onClose)

  useEffect(() => {
    if (open) setMode({ kind: 'list' })
  }, [open])

  useEffect(() => {
    if (!cityId && (enabledCities[0] ?? cities[0])) setCityId((enabledCities[0] ?? cities[0]).id)
  }, [cityId, enabledCities, cities])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
          aria-label="Premios del mes"
        >
          <motion.div
            className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[32px] bg-cream-50 shadow-float sm:rounded-[32px]"
            initial={{ y: 40, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {mode.kind === 'list' ? (
              <PrizeList
                cityId={cityId}
                month={month}
                months={months}
                onCity={setCityId}
                onMonth={setMonth}
                onClose={onClose}
                onEdit={(prize) => setMode({ kind: 'edit', prize })}
              />
            ) : (
              <PrizeEditor prize={mode.prize} cityId={cityId} month={month} onBack={() => setMode({ kind: 'list' })} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function PrizeList({
  cityId,
  month,
  months,
  onCity,
  onMonth,
  onClose,
  onEdit,
}: {
  cityId: string
  month: string
  months: string[]
  onCity: (id: string) => void
  onMonth: (m: string) => void
  onClose: () => void
  onEdit: (p: Prize | null) => void
}) {
  const { cities } = useCities()
  const { prizes, loading, error } = usePrizes()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const list = prizes.filter((p) => p.cityId === cityId && p.month === month)

  const remove = async (p: Prize) => {
    if (!window.confirm(`¿Quitar el premio "${p.title}"?`)) return
    setBusy(p.id)
    setErr(null)
    try {
      await deletePrize(p.id)
    } catch (e) {
      console.error(e)
      setErr('No se pudo quitar el premio. ¿Están publicadas las reglas de Firestore?')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Header title="Premios del mes" subtitle="Lo que ganan los primeros del ranking de cada ciudad" onClose={onClose} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-6">
        <div className="flex gap-2">
          <select value={cityId} onChange={(e) => onCity(e.target.value)} className="field flex-1 py-2 text-sm font-semibold" aria-label="Ciudad">
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.enabled ? '' : ' (pausada)'}
              </option>
            ))}
          </select>
          <select value={month} onChange={(e) => onMonth(e.target.value)} className="field w-auto py-2 text-sm font-semibold capitalize" aria-label="Mes">
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="grid place-items-center py-10">
            <LoaderCircle className="h-6 w-6 animate-spin text-coral" />
          </div>
        ) : error ? (
          <p className="text-sm text-coral-deep">{error}</p>
        ) : list.length === 0 ? (
          <p className="rounded-2xl bg-cream-100 px-4 py-6 text-center text-sm text-ink-muted">
            <span className="mb-1 block text-3xl">🎁</span>
            Aún no hay premios para <span className="capitalize">{monthLabel(month)}</span>. Si no agregas ninguno, el ranking no muestra
            la sección de premios.
          </p>
        ) : (
          list.map((p) => (
            <div key={p.id} className="card flex items-center gap-3 p-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-butter-soft text-2xl">{p.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-butter-deep">{placeLabel(p.place)}</p>
                <p className="truncate font-display text-lg font-medium leading-tight">{p.title}</p>
                {(p.detail || p.sponsor) && (
                  <p className="truncate text-xs text-ink-muted">
                    {p.detail}
                    {p.detail && p.sponsor && ' · '}
                    {p.sponsor && `Auspicia ${p.sponsor}`}
                  </p>
                )}
              </div>
              <button onClick={() => onEdit(p)} className="icon-btn h-10 w-10 shadow-none ring-2 ring-line" aria-label={`Editar ${p.title}`}>
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(p)}
                disabled={busy === p.id}
                className="icon-btn h-10 w-10 text-coral-deep shadow-none ring-2 ring-line"
                aria-label={`Quitar ${p.title}`}
              >
                {busy === p.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))
        )}
        {err && <p className="text-sm text-coral-deep">{err}</p>}

        <button className="btn-soft w-full" onClick={() => onEdit(null)} disabled={!cityId}>
          <Plus className="h-4 w-4" /> Agregar premio
        </button>
        <p className="px-2 text-xs text-ink-muted">
          Los vecinos ven estos premios en el ranking de <b>Este mes</b> de su ciudad. Los del mes siguiente aparecen recién cuando
          empieza.
        </p>
      </div>
    </>
  )
}

const EMOJIS = ['🎁', '🏆', '🍕', '🎟️', '🛒', '☕', '📱', '👕', '🚲', '💵']

function PrizeEditor({ prize, cityId, month, onBack }: { prize: Prize | null; cityId: string; month: string; onBack: () => void }) {
  const { cityName } = useCities()
  const [place, setPlace] = useState(prize?.place ?? 1)
  const [emoji, setEmoji] = useState(prize?.emoji ?? '🎁')
  const [title, setTitle] = useState(prize?.title ?? '')
  const [detail, setDetail] = useState(prize?.detail ?? '')
  const [sponsor, setSponsor] = useState(prize?.sponsor ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    if (!title.trim() || !emoji.trim()) return
    setSaving(true)
    setErr(null)
    try {
      await savePrize({
        id: prize?.id,
        cityId: prize?.cityId ?? cityId,
        month: prize?.month ?? month,
        place,
        emoji: emoji.trim(),
        title,
        detail,
        sponsor,
      })
      onBack()
    } catch (e) {
      console.error(e)
      setErr('No se pudo guardar. Revisa que las reglas de Firestore estén publicadas.')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <button onClick={onBack} className="icon-btn h-10 w-10" aria-label="Volver a la lista">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold leading-tight">{prize ? 'Editar premio' : 'Nuevo premio'}</p>
          <p className="text-sm capitalize text-ink-muted">
            {cityName(prize?.cityId ?? cityId)} · {monthLabel(prize?.month ?? month)}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink-soft">Puesto que lo gana</span>
          <select value={place} onChange={(e) => setPlace(Number(e.target.value))} className="field py-2">
            {Array.from({ length: MAX_PRIZE_PLACE }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {placeLabel(n)}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm">
          <span className="mb-1 block font-semibold text-ink-soft">Ícono</span>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`grid h-10 w-10 place-items-center rounded-2xl text-xl transition ${
                  emoji === e ? 'bg-butter-soft ring-2 ring-butter' : 'bg-white ring-2 ring-line'
                }`}
                aria-label={`Usar ${e}`}
                aria-pressed={emoji === e}
              >
                {e}
              </button>
            ))}
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="field h-10 w-16 py-0 text-center text-xl"
              maxLength={8}
              aria-label="Otro emoji"
            />
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink-soft">Premio</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Vale de consumo de S/ 50"
            className="field py-2.5"
            maxLength={60}
            autoFocus={!prize}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink-soft">Detalle (opcional)</span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Cómo se entrega, condiciones…"
            className="field min-h-20 py-2.5"
            maxLength={200}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink-soft">Auspiciador (opcional)</span>
          <input value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="Ej. Municipalidad de Tacna" className="field py-2.5" maxLength={60} />
        </label>

        {err && <p className="text-sm text-coral-deep">{err}</p>}
        <button className="btn-primary w-full" onClick={save} disabled={saving || !title.trim() || !emoji.trim()}>
          {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}
          {prize ? 'Guardar cambios' : 'Publicar premio'}
        </button>
      </div>
    </>
  )
}

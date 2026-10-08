import { useEffect, useMemo, useState } from 'react'
import { subscribeConfirmations, subscribeGoogleBonuses, subscribeProfiles } from '../lib/profiles'
import { levelFor, pointEvents, totalFor } from '../lib/points'
import type { Confirmation, GoogleBonus } from '../lib/points'
import type { Profile, Report } from '../lib/types'

/** Confirmaciones + bonos de Google + perfiles + eventos de puntos, a partir de los reportes ya cargados. */
export function usePointsData(reports: Report[]) {
  const [confirmations, setConfirmations] = useState<Confirmation[] | null>(null)
  const [profiles, setProfiles] = useState<Map<string, Profile> | null>(null)
  const [bonuses, setBonuses] = useState<GoogleBonus[] | null>(null)

  useEffect(
    () =>
      subscribeConfirmations(setConfirmations, (e) => {
        console.error('No se pudieron cargar las confirmaciones', e)
        setConfirmations([])
      }),
    [],
  )
  useEffect(
    () =>
      subscribeProfiles(setProfiles, (e) => {
        console.error('No se pudieron cargar los perfiles', e)
        setProfiles(new Map())
      }),
    [],
  )

  useEffect(
    () =>
      subscribeGoogleBonuses(setBonuses, (e) => {
        console.error('No se pudieron cargar los bonos de Google', e)
        setBonuses([])
      }),
    [],
  )

  const events = useMemo(() => pointEvents(reports, confirmations ?? [], bonuses ?? []), [reports, confirmations, bonuses])
  return {
    events,
    confirmations: confirmations ?? [],
    bonuses: bonuses ?? [],
    profiles: profiles ?? new Map<string, Profile>(),
    loading: confirmations === null || profiles === null || bonuses === null,
  }
}

/** Puntos, nivel y perfil de una persona. */
export function useMyPoints(uid: string | undefined, reports: Report[]) {
  const data = usePointsData(reports)
  const total = uid ? totalFor(uid, data.events) : 0
  const month = uid ? totalFor(uid, data.events, 'month') : 0
  return {
    ...data,
    total,
    month,
    profile: uid ? (data.profiles.get(uid) ?? null) : null,
    ...levelFor(total),
  }
}

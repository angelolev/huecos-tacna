import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AdvancedMarker, ColorScheme, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import type { AdvancedMarkerProps } from '@vis.gl/react-google-maps'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import type { Marker, Renderer } from '@googlemaps/markerclusterer'
import { STATUS_META } from '../lib/types'
import { useCities } from '../context/CitiesContext'
import type { LatLng, Report } from '../lib/types'
import { MAP_ID } from './MapsProvider'

interface Props {
  reports: Report[]
  userLocation?: LatLng | null
  selectedId?: string | null
  onSelect?: (report: Report) => void
  /** La persona arrastró el mapa (deja de seguir la vista automática). */
  onUserMove?: () => void
  children?: ReactNode
  className?: string
}

/** Mapa con los reportes agrupados en burbujas. */
export function ReportsMap({ reports, userLocation, selectedId, onSelect, onUserMove, children, className }: Props) {
  const { defaultCity } = useCities()
  return (
    <Map
      className={className}
      mapId={MAP_ID}
      colorScheme={ColorScheme.LIGHT}
      defaultCenter={defaultCity.center}
      defaultZoom={13}
      gestureHandling="greedy"
      disableDefaultUI
      clickableIcons={false}
      onDragstart={onUserMove}
    >
      <ClusteredMarkers reports={reports} selectedId={selectedId} onSelect={onSelect} />
      <PanToSelected report={reports.find((r) => r.id === selectedId) ?? null} />
      {userLocation && (
        <AdvancedMarker position={userLocation} zIndex={3000} anchorLeft="-50%" anchorTop="-50%">
          <UserDot />
        </AdvancedMarker>
      )}
      {children}
    </Map>
  )
}

const clusterRenderer: Renderer = {
  render({ count, position }) {
    const el = document.createElement('div')
    el.className = 'cluster-bubble'
    el.textContent = String(count)
    return new google.maps.marker.AdvancedMarkerElement({
      position,
      content: el,
      zIndex: 1000 + count,
    })
  },
}

function ClusteredMarkers({ reports, selectedId, onSelect }: Pick<Props, 'reports' | 'selectedId' | 'onSelect'>) {
  const map = useMap()
  const markerLib = useMapsLibrary('marker')
  const [markers, setMarkers] = useState<Record<string, Marker>>({})

  const clusterer = useMemo(() => {
    if (!map || !markerLib) return null
    return new MarkerClusterer({ map, renderer: clusterRenderer })
  }, [map, markerLib])

  useEffect(() => () => clusterer?.setMap(null), [clusterer])

  useEffect(() => {
    if (!clusterer) return
    clusterer.clearMarkers()
    clusterer.addMarkers(Object.values(markers))
  }, [clusterer, markers])

  const setMarkerRef = useCallback((marker: Marker | null, key: string) => {
    setMarkers((prev) => {
      if ((marker && prev[key] === marker) || (!marker && !prev[key])) return prev
      if (marker) return { ...prev, [key]: marker }
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  return (
    <>
      {reports.map((r) => (
        <ReportMarker
          key={r.id}
          report={r}
          selected={r.id === selectedId}
          onClick={onSelect}
          setMarkerRef={setMarkerRef}
        />
      ))}
    </>
  )
}

function ReportMarker({
  report,
  selected,
  onClick,
  setMarkerRef,
}: {
  report: Report
  selected: boolean
  onClick?: (r: Report) => void
  setMarkerRef: (m: Marker | null, key: string) => void
}) {
  const ref = useCallback(
    (m: google.maps.marker.AdvancedMarkerElement | null) => setMarkerRef(m, report.id),
    [setMarkerRef, report.id],
  )
  const meta = STATUS_META[report.status] ?? STATUS_META.pendiente
  const handleClick: AdvancedMarkerProps['onClick'] = () => onClick?.(report)

  return (
    <AdvancedMarker
      ref={ref}
      position={{ lat: report.lat, lng: report.lng }}
      onClick={handleClick}
      zIndex={selected ? 2000 : undefined}
    >
      <ReportPin color={meta.color} selected={selected} big={report.severity === 'peligroso'} />
    </AdvancedMarker>
  )
}

/** Pin redondeado del color del estado, con un "huequito" al centro. */
export function ReportPin({ color, selected, big }: { color: string; selected?: boolean; big?: boolean }) {
  const w = big ? 38 : 32
  return (
    <div
      className="relative origin-bottom transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]"
      style={{ transform: selected ? 'scale(1.35) translateY(-2px)' : undefined }}
    >
      {selected && (
        <span
          className="absolute left-1/2 top-full h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full animate-halo"
          style={{ background: color }}
        />
      )}
      <svg width={w} height={w * 1.2} viewBox="0 0 40 48" className="relative animate-pop drop-shadow-[0_6px_6px_rgba(120,84,60,.35)]">
        <path
          d="M20 46c-1 0-1.9-.5-2.5-1.3C12 37.2 3 28.2 3 19 3 9.6 10.6 2.5 20 2.5S37 9.6 37 19c0 9.2-9 18.2-14.5 25.7-.6.8-1.5 1.3-2.5 1.3z"
          fill={color}
          stroke="#fff"
          strokeWidth="3"
        />
        <circle cx="20" cy="18.5" r="9" fill="#fff" />
        <ellipse cx="20" cy="20" rx="5.5" ry="3" fill="#2F2B3A" />
      </svg>
    </div>
  )
}

function UserDot() {
  return (
    <div className="relative grid h-5 w-5 place-items-center">
      <span className="absolute inset-0 rounded-full bg-sky animate-halo" />
      <span className="relative h-5 w-5 rounded-full border-[3px] border-white bg-sky-shade shadow-soft" />
    </div>
  )
}

function PanToSelected({ report }: { report: Report | null }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !report) return
    map.panTo({ lat: report.lat, lng: report.lng })
    if ((map.getZoom() ?? 0) < 16) map.setZoom(16)
  }, [map, report?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

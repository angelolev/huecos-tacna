import { APIProvider } from '@vis.gl/react-google-maps'
import type { ReactNode } from 'react'

export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
export const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || 'DEMO_MAP_ID'

export function MapsProvider({ children }: { children: ReactNode }) {
  return (
    <APIProvider apiKey={MAPS_API_KEY ?? ''} language="es" region="PE">
      {children}
    </APIProvider>
  )
}

import { Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CitiesProvider } from './context/CitiesContext'
import { MAPS_API_KEY, MapsProvider } from './components/MapsProvider'
import { SetupScreen } from './components/SetupScreen'
import { isFirebaseConfigured } from './lib/firebase'
import { lazyWithReload, onUpdate, updatePending } from './lib/updates'
import { trackPage } from './lib/analytics'
import HomePage from './pages/HomePage'

const ReportPage = lazyWithReload(() => import('./pages/report/ReportPage'))
const MyReportsPage = lazyWithReload(() => import('./pages/MyReportsPage'))
const AdminGate = lazyWithReload(() => import('./pages/admin/AdminGate'))
const AboutPage = lazyWithReload(() => import('./pages/AboutPage'))
const RankingPage = lazyWithReload(() => import('./pages/RankingPage'))
const NeighborPage = lazyWithReload(() => import('./pages/NeighborPage'))

function Splash() {
  return (
    <div className="grid h-dvh place-items-center bg-cream-100">
      <LoaderCircle className="h-7 w-7 animate-spin text-coral" />
    </div>
  )
}

function ShareRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/?r=${encodeURIComponent(id)}` : '/'} replace />
}

/**
 * Con una versión nueva instalada, recarga en un momento que no moleste: al cambiar de pantalla
 * (la nueva ya abre actualizada) o al dejar la app en segundo plano. Nunca en medio de un reporte.
 */
function UpdateWatcher() {
  const { pathname } = useLocation()
  const [pending, setPending] = useState(updatePending)
  const lastPath = useRef(pathname)

  useEffect(() => onUpdate(() => setPending(true)), [])

  useEffect(() => {
    if (pending && pathname !== lastPath.current) window.location.reload()
    lastPath.current = pathname
  }, [pending, pathname])

  useEffect(() => {
    if (!pending) return
    const onHide = () => {
      if (document.visibilityState === 'hidden' && window.location.pathname !== '/reportar') window.location.reload()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [pending])

  return null
}

/** Una visita en Analytics por cada pantalla (no por hojas o parámetros como ?r=). */
function PageTracker() {
  const { pathname } = useLocation()
  useEffect(() => trackPage(pathname), [pathname])
  return null
}

function AppRoutes() {
  const { loading } = useAuth()
  if (loading) return <Splash />
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/reportar" element={<ReportPage />} />
        <Route path="/mis-reportes" element={<MyReportsPage />} />
        <Route path="/admin" element={<AdminGate />} />
        <Route path="/acerca" element={<AboutPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/vecino/:uid" element={<NeighborPage />} />
        {/* Enlace para compartir un reporte (con vista previa de su foto, ver api/share.ts) */}
        <Route path="/h/:id" element={<ShareRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  if (!isFirebaseConfigured || !MAPS_API_KEY) {
    return <SetupScreen firebase={isFirebaseConfigured} maps={!!MAPS_API_KEY} />
  }
  return (
    <AuthProvider>
      <CitiesProvider>
        <MapsProvider>
          <BrowserRouter>
            <UpdateWatcher />
            <PageTracker />
            <AppRoutes />
          </BrowserRouter>
        </MapsProvider>
      </CitiesProvider>
    </AuthProvider>
  )
}

import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CitiesProvider } from './context/CitiesContext'
import { MAPS_API_KEY, MapsProvider } from './components/MapsProvider'
import { SetupScreen } from './components/SetupScreen'
import { isFirebaseConfigured } from './lib/firebase'
import HomePage from './pages/HomePage'

const ReportPage = lazy(() => import('./pages/report/ReportPage'))
const MyReportsPage = lazy(() => import('./pages/MyReportsPage'))
const AdminGate = lazy(() => import('./pages/admin/AdminGate'))
const AboutPage = lazy(() => import('./pages/AboutPage'))

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
            <AppRoutes />
          </BrowserRouter>
        </MapsProvider>
      </CitiesProvider>
    </AuthProvider>
  )
}

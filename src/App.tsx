import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { MAPS_API_KEY, MapsProvider } from './components/MapsProvider'
import { SetupScreen } from './components/SetupScreen'
import { isFirebaseConfigured } from './lib/firebase'
import HomePage from './pages/HomePage'

const ReportPage = lazy(() => import('./pages/report/ReportPage'))
const MyReportsPage = lazy(() => import('./pages/MyReportsPage'))
const AdminGate = lazy(() => import('./pages/admin/AdminGate'))

function Splash() {
  return (
    <div className="grid h-dvh place-items-center bg-cream-100">
      <LoaderCircle className="h-7 w-7 animate-spin text-coral" />
    </div>
  )
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
      <MapsProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </MapsProvider>
    </AuthProvider>
  )
}

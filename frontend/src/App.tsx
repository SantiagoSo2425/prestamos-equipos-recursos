import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Role } from './api/types'
import { useAuth } from './auth/AuthContext'
import LoginPage from './auth/LoginPage'
import ProtectedRoute from './auth/ProtectedRoute'
import { HOME_BY_ROLE } from './auth/roles'
import Layout from './components/Layout'
import CatalogPage from './pages/catalog/CatalogPage'
import ResourceDetailPage from './pages/catalog/ResourceDetailPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import HistoryPage from './pages/dashboard/HistoryPage'
import LoanDetailPage from './pages/loans/LoanDetailPage'
import MyRequestsPage from './pages/requests/MyRequestsPage'
import NewRequestPage from './pages/requests/NewRequestPage'
import ReviewInboxPage from './pages/review/ReviewInboxPage'

const S: Role = 'SOLICITANTE'
const R: Role = 'RESPONSABLE'
const C: Role = 'COORDINACION'

/** Ruta protegida por rol y con el layout común. */
function guarded(roles: Role[], element: ReactNode) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{element}</Layout>
    </ProtectedRoute>
  )
}

function Home() {
  const { user } = useAuth()
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Home />} />
      <Route path="/catalogo" element={guarded([S, R, C], <CatalogPage />)} />
      <Route path="/catalogo/:id" element={guarded([S, R, C], <ResourceDetailPage />)} />
      <Route path="/solicitudes/nueva" element={guarded([S], <NewRequestPage />)} />
      <Route path="/mis-solicitudes" element={guarded([S], <MyRequestsPage />)} />
      <Route path="/gestion" element={guarded([R], <ReviewInboxPage />)} />
      <Route path="/prestamos/:id" element={guarded([S, R, C], <LoanDetailPage />)} />
      <Route path="/tablero" element={guarded([R, C], <DashboardPage />)} />
      <Route path="/historial" element={guarded([R, C], <HistoryPage />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

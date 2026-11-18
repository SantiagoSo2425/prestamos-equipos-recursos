import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Role } from './api/types'
import { useAuth } from './auth/AuthContext'
import LoginPage from './auth/LoginPage'
import ProtectedRoute from './auth/ProtectedRoute'
import { HOME_BY_ROLE } from './auth/roles'
import Layout from './components/Layout'
import LoanDetailPage from './pages/loans/LoanDetailPage'
import Placeholder from './pages/Placeholder'
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
      <Route path="/catalogo" element={guarded([S, R], <Placeholder title="Catálogo" />)} />
      <Route path="/catalogo/:id" element={guarded([S, R, C], <Placeholder title="Detalle del recurso" />)} />
      <Route path="/recursos/nuevo" element={guarded([R], <Placeholder title="Nuevo recurso" />)} />
      <Route path="/recursos/:id/editar" element={guarded([R], <Placeholder title="Editar recurso" />)} />
      <Route path="/solicitudes/nueva" element={guarded([S], <Placeholder title="Nueva solicitud" />)} />
      <Route path="/mis-solicitudes" element={guarded([S], <Placeholder title="Mis solicitudes" />)} />
      <Route path="/gestion" element={guarded([R], <ReviewInboxPage />)} />
      <Route path="/prestamos/:id" element={guarded([S, R, C], <LoanDetailPage />)} />
      <Route path="/tablero" element={guarded([R, C], <Placeholder title="Tablero" />)} />
      <Route path="/historial" element={guarded([C, R], <Placeholder title="Historial" />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

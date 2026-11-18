import type { ReactNode } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import type { Role } from './api/types'
import { useAuth } from './auth/AuthContext'
import LoginPage from './auth/LoginPage'
import ProtectedRoute from './auth/ProtectedRoute'
import CatalogPage from './pages/catalog/CatalogPage'
import ResourceDetailPage from './pages/catalog/ResourceDetailPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import HistoryPage from './pages/dashboard/HistoryPage'
import MyRequestsPage from './pages/requests/MyRequestsPage'
import NewRequestPage from './pages/requests/NewRequestPage'
import ResourceFormPage from './pages/resources/ResourceFormPage'

// Barra de navegación provisional de la fundación de A; Persona B la reemplaza por
// <Layout>/<NavBar> (T035) y completa las rutas de evaluación, entrega y detalle (T034).
function Shell({ children }: { children: ReactNode }) {
  const { user, logout, hasRole } = useAuth()
  return (
    <>
      <header className="topbar">
        <nav>
          <Link to="/catalogo">Catálogo</Link>
          {hasRole('SOLICITANTE') && <Link to="/mis-solicitudes">Mis solicitudes</Link>}
          {hasRole('RESPONSABLE', 'COORDINACION') && <Link to="/tablero">Tablero</Link>}
          {hasRole('COORDINACION') && <Link to="/historial">Historial</Link>}
        </nav>
        <span className="muted">
          {user?.full_name} ({user?.role})
        </span>
        <button className="secondary" onClick={logout}>
          Cerrar sesión
        </button>
      </header>
      {children}
    </>
  )
}

function Guarded({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  return (
    <ProtectedRoute roles={roles}>
      <Shell>{children}</Shell>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/catalogo"
        element={
          <Guarded>
            <CatalogPage />
          </Guarded>
        }
      />
      <Route
        path="/catalogo/:id"
        element={
          <Guarded>
            <ResourceDetailPage />
          </Guarded>
        }
      />
      <Route
        path="/recursos/nuevo"
        element={
          <Guarded roles={['RESPONSABLE']}>
            <ResourceFormPage />
          </Guarded>
        }
      />
      <Route
        path="/recursos/:id/editar"
        element={
          <Guarded roles={['RESPONSABLE']}>
            <ResourceFormPage />
          </Guarded>
        }
      />
      <Route
        path="/solicitudes/nueva"
        element={
          <Guarded roles={['SOLICITANTE']}>
            <NewRequestPage />
          </Guarded>
        }
      />
      <Route
        path="/mis-solicitudes"
        element={
          <Guarded roles={['SOLICITANTE']}>
            <MyRequestsPage />
          </Guarded>
        }
      />
      <Route
        path="/tablero"
        element={
          <Guarded roles={['RESPONSABLE', 'COORDINACION']}>
            <DashboardPage />
          </Guarded>
        }
      />
      <Route
        path="/historial"
        element={
          <Guarded roles={['RESPONSABLE', 'COORDINACION']}>
            <HistoryPage />
          </Guarded>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './auth/LoginPage'
import ProtectedRoute from './auth/ProtectedRoute'
import { useAuth } from './auth/AuthContext'

// Marcador temporal hasta que cada historia aporte su página.
function Placeholder({ title }: { title: string }) {
  const { user, logout } = useAuth()
  return (
    <main>
      <h1>{title}</h1>
      <p>
        Sesión: {user?.full_name} ({user?.role})
      </p>
      <button onClick={logout}>Cerrar sesión</button>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/catalogo"
        element={
          <ProtectedRoute roles={['SOLICITANTE', 'RESPONSABLE']}>
            <Placeholder title="Catálogo" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gestion"
        element={
          <ProtectedRoute roles={['RESPONSABLE']}>
            <Placeholder title="Gestión" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tablero"
        element={
          <ProtectedRoute roles={['RESPONSABLE', 'COORDINACION']}>
            <Placeholder title="Tablero" />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

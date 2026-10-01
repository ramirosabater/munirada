import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, roles }) {
  const { session, profile, loading, signOut } = useAuth()
  if (loading) return <div className="center-screen">Cargando…</div>
  if (!session) return <Navigate to="/ingresar" replace />
  if (!profile) return <div className="center-screen">Cargando…</div>

  if (profile.activo === false) {
    return (
      <div className="center-screen">
        <div className="auth-card center">
          <h1>Cuenta inhabilitada</h1>
          <p className="muted">Comunicate con la Municipalidad para revisar tu cuenta.</p>
          <button className="btn btn-ghost" onClick={signOut}>Salir</button>
        </div>
      </div>
    )
  }
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

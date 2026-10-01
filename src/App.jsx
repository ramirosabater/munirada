import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Ingresar from './pages/Ingresar'
import Registro from './pages/Registro'

import Inicio from './pages/vecino/Inicio'
import Actividades from './pages/vecino/Actividades'
import MisActividades from './pages/vecino/MisActividades'
import MisPagos from './pages/vecino/MisPagos'
import Reclamos from './pages/vecino/Reclamos'
import Turnos from './pages/vecino/Turnos'
import Tramites from './pages/vecino/Tramites'
import MiCuenta from './pages/vecino/MiCuenta'

import Panel from './pages/gestion/Panel'
import GestionActividades from './pages/gestion/GestionActividades'
import TomarAsistencia from './pages/gestion/TomarAsistencia'
import RevisarPagos from './pages/gestion/RevisarPagos'
import Cobranzas from './pages/gestion/Cobranzas'
import BandejaReclamos from './pages/gestion/BandejaReclamos'
import GestionTurnos from './pages/gestion/GestionTurnos'
import Avisos from './pages/gestion/Avisos'
import Usuarios from './pages/gestion/Usuarios'

const navVecino = [
  { to: '/', label: 'Inicio', icon: 'inicio' },
  { to: '/actividades', label: 'Actividades', icon: 'actividad' },
  { to: '/mis-actividades', label: 'Mis inscripciones' },
  { to: '/pagos', label: 'Pagos', icon: 'pago' },
  { to: '/reclamos', label: 'Reclamos', icon: 'reclamo' },
  { to: '/turnos', label: 'Turnos', icon: 'turno' },
  { to: '/tramites', label: 'Trámites y teléfonos' },
  { to: '/cuenta', label: 'Mi cuenta', icon: 'cuenta', short: 'Cuenta' },
]
const bottomVecino = ['/', '/actividades', '/reclamos', '/turnos', '/cuenta']
  .map(to => navVecino.find(n => n.to === to))

function GestionLayout() {
  const { profile, isGestor, isAdmin } = useAuth()
  const nav = [{ to: '/gestion', label: 'Resumen' }]
  nav.push({ to: '/gestion/actividades', label: profile.role === 'profesor' ? 'Mis grupos' : 'Actividades' })
  nav.push({ to: '/gestion/asistencia', label: 'Asistencia' })
  if (isGestor) {
    nav.push({ to: '/gestion/pagos', label: 'Pagos' })
    nav.push({ to: '/gestion/cobranzas', label: 'Cobranzas' })
    nav.push({ to: '/gestion/reclamos', label: 'Reclamos' })
    nav.push({ to: '/gestion/turnos', label: 'Turnos' })
    nav.push({ to: '/gestion/avisos', label: 'Avisos' })
  }
  if (isAdmin) nav.push({ to: '/gestion/usuarios', label: 'Usuarios' })
  return <Layout nav={nav} modo="gestion" />
}

const STAFF = ['profesor', 'agente', 'admin']
const GESTORES = ['agente', 'admin']

export default function App() {
  const { session, loading } = useAuth()
  return (
    <Routes>
      <Route path="/ingresar" element={!loading && session ? <Navigate to="/" replace /> : <Ingresar />} />
      <Route path="/registro" element={!loading && session ? <Navigate to="/" replace /> : <Registro />} />

      <Route path="/" element={<ProtectedRoute><Layout nav={navVecino} bottomNav={bottomVecino} /></ProtectedRoute>}>
        <Route index element={<Inicio />} />
        <Route path="actividades" element={<Actividades />} />
        <Route path="mis-actividades" element={<MisActividades />} />
        <Route path="pagos" element={<MisPagos />} />
        <Route path="reclamos" element={<Reclamos />} />
        <Route path="turnos" element={<Turnos />} />
        <Route path="tramites" element={<Tramites />} />
        <Route path="cuenta" element={<MiCuenta />} />
      </Route>

      <Route path="/gestion" element={<ProtectedRoute roles={STAFF}><GestionLayout /></ProtectedRoute>}>
        <Route index element={<Panel />} />
        <Route path="actividades" element={<GestionActividades />} />
        <Route path="asistencia" element={<TomarAsistencia />} />
        <Route path="pagos" element={<ProtectedRoute roles={GESTORES}><RevisarPagos /></ProtectedRoute>} />
        <Route path="cobranzas" element={<ProtectedRoute roles={GESTORES}><Cobranzas /></ProtectedRoute>} />
        <Route path="reclamos" element={<ProtectedRoute roles={GESTORES}><BandejaReclamos /></ProtectedRoute>} />
        <Route path="turnos" element={<ProtectedRoute roles={GESTORES}><GestionTurnos /></ProtectedRoute>} />
        <Route path="avisos" element={<ProtectedRoute roles={GESTORES}><Avisos /></ProtectedRoute>} />
        <Route path="usuarios" element={<ProtectedRoute roles={['admin']}><Usuarios /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

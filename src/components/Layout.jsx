import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES, AREAS } from '../lib/municipio'
import Brand from './Brand'
import Shore from './Shore'
import Icon from './Icon'

export default function Layout({ nav, bottomNav, modo }) {
  const { profile, isStaff, signOut } = useAuth()
  const rol = ROLES[profile?.role] + (profile?.role === 'agente' && profile?.area ? ` · ${AREAS[profile.area] ?? profile.area}` : '')
  return (
    <div className={'app-shell' + (bottomNav ? ' has-bottom' : '')}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to={modo === 'gestion' ? '/gestion' : '/'} style={{ textDecoration: 'none', minWidth: 0 }}>
            <Brand sub={modo === 'gestion' ? 'Gestión municipal · ' + rol : 'Servicios al vecino'} />
          </Link>
          <div className="topbar-right">
            {isStaff && (modo === 'gestion'
              ? <Link className="switch-link" to="/">Vista vecino</Link>
              : <Link className="switch-link" to="/gestion">Gestión</Link>)}
            <span className="who">{profile?.full_name}</span>
            <button className="btn btn-ghost btn-sm" onClick={signOut}>Salir</button>
          </div>
        </div>
        <Shore />
      </header>
      <nav className="tabs" aria-label="Secciones">
        {nav.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end ?? true}
            className={({ isActive }) => 'tab' + (isActive ? ' tab-active' : '')}>{n.label}</NavLink>
        ))}
      </nav>
      <main className="content"><Outlet /></main>
      {bottomNav && (
        <nav className="bottom-nav" aria-label="Navegación principal">
          {bottomNav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end ?? true} className={({ isActive }) => (isActive ? 'on' : '')}>
              <Icon name={n.icon} size={22} />{n.short ?? n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

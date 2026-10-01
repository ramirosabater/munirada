import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { hoyISO, hora, fechaLarga, horarioTexto } from '../../lib/formato'
import { AREAS } from '../../lib/municipio'

const contar = q => q.then(({ count }) => count ?? 0)

export default function Panel() {
  const { profile, uid, isGestor } = useAuth()
  const [n, setN] = useState({})
  const [turnosHoy, setTurnosHoy] = useState([])
  const [clasesHoy, setClasesHoy] = useState([])

  useEffect(() => {
    const h = hoyISO()
    // RLS ya limita cada consulta a lo que este usuario puede ver
    if (isGestor) {
      Promise.all([
        contar(supabase.from('reclamos').select('id', { count: 'exact', head: true }).eq('estado', 'recibido')),
        contar(supabase.from('reclamos').select('id', { count: 'exact', head: true }).eq('estado', 'en_curso')),
        contar(supabase.from('pagos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')),
        contar(supabase.from('inscripciones').select('id', { count: 'exact', head: true }).in('estado', ['pendiente', 'espera'])),
        contar(supabase.from('turnos').select('id', { count: 'exact', head: true }).eq('fecha', h).eq('estado', 'confirmado')),
      ]).then(([rec, curso, pagos, solic, turnos]) => setN({ rec, curso, pagos, solic, turnos }))
      supabase.from('turnos').select('id, hora, notas, servicio:servicios_turno(nombre), vecino:profiles!vecino_id(full_name)')
        .eq('fecha', h).eq('estado', 'confirmado').order('hora').limit(8).then(({ data }) => setTurnosHoy(data ?? []))
    }
    let q = supabase.from('actividades').select('id, nombre, dias, hora_inicio, hora_fin, fecha_evento, area, profesor_id').eq('activa', true)
    if (profile.role === 'profesor') q = q.eq('profesor_id', uid)
    else if (profile.role === 'agente') q = q.eq('area', profile.area)
    q.then(({ data }) => {
      const dow = new Date().getDay()
      setClasesHoy((data ?? []).filter(a => a.fecha_evento ? a.fecha_evento === h : a.dias?.includes(dow))
        .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || '')))
    })
  }, [])

  const STATS = [
    { k: 'rec', l: 'Reclamos nuevos', to: '/gestion/reclamos' },
    { k: 'curso', l: 'Reclamos en curso', to: '/gestion/reclamos' },
    { k: 'pagos', l: 'Pagos para revisar', to: '/gestion/pagos' },
    { k: 'solic', l: 'Solicitudes y lista de espera', to: '/gestion/actividades' },
    { k: 'turnos', l: 'Turnos de hoy', to: '/gestion/turnos' },
  ]
  return (
    <div className="stack">
      <div className="page-head"><div>
        <h1>Resumen</h1>
        <p>{fechaLarga(hoyISO())}{profile.role === 'agente' && profile.area ? ` · ${AREAS[profile.area] ?? profile.area}` : ''}</p>
      </div></div>
      {isGestor && (
        <div className="stats">{STATS.map(s => (
          <Link key={s.k} to={s.to} className="stat">
            <div className="stat-num">{n[s.k] ?? '–'}</div><div className="stat-lbl">{s.l}</div>
          </Link>))}
        </div>
      )}
      <div className="grid-2">
        <section className="card">
          <h2>Actividades de hoy</h2>
          {clasesHoy.length === 0 ? <p className="muted">No hay actividades hoy.</p> : (
            <ul className="list">{clasesHoy.map(a => (
              <li key={a.id} className="list-item row-between">
                <span><b>{a.nombre}</b><div className="small muted">{horarioTexto(a)}</div></span>
                <Link className="btn btn-sm btn-ghost" to={`/gestion/asistencia?actividad=${a.id}`}>Tomar asistencia</Link>
              </li>))}</ul>
          )}
        </section>
        {isGestor && (
          <section className="card">
            <h2>Turnos de hoy</h2>
            {turnosHoy.length === 0 ? <p className="muted">Sin turnos para hoy.</p> : (
              <ul className="list">{turnosHoy.map(t => (
                <li key={t.id} className="list-item">
                  <b className="num">{hora(t.hora)}</b> · {t.vecino?.full_name} <span className="small muted">· {t.servicio?.nombre}</span>
                </li>))}</ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

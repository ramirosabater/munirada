import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { TELEFONOS_UTILES, telHref } from '../../lib/municipio'
import { hoyISO, fechaLarga, hora, horarioTexto } from '../../lib/formato'
import AvisoCuota from '../../components/AvisoCuota'
import Icon from '../../components/Icon'
import Estado from '../../components/Estado'

const ACCESOS = [
  { to: '/actividades', icon: 'actividad', t: 'Inscribirme a una actividad', d: 'Deportes, talleres de arte, adultos mayores.' },
  { to: '/reclamos', icon: 'reclamo', t: 'Hacer un reclamo', d: 'Alumbrado, calles, residuos, poda.', ocre: true },
  { to: '/turnos', icon: 'turno', t: 'Sacar un turno', d: 'Castraciones, atención en Hacienda.' },
  { to: '/pagos', icon: 'pago', t: 'Pagar cuotas', d: 'Subí el comprobante de tus actividades.' },
  { to: '/tramites', icon: 'tramite', t: 'Tasas y trámites', d: 'Deuda, e-boleta, licencia de conducir.', ocre: true },
  { to: '/cuenta', icon: 'familia', t: 'Mi grupo familiar', d: 'Sumá a quienes inscribís.' },
]

export default function Inicio() {
  const { profile, uid } = useAuth()
  const [avisos, setAvisos] = useState([])
  const [turnos, setTurnos] = useState([])
  const [reclamos, setReclamos] = useState([])
  const [hoy, setHoy] = useState([])

  useEffect(() => {
    const h = hoyISO()
    supabase.from('avisos').select('*').eq('publicado', true).lte('desde', h)
      .or(`hasta.is.null,hasta.gte.${h}`).order('desde', { ascending: false }).limit(4)
      .then(({ data }) => setAvisos(data ?? []))
    supabase.from('turnos').select('id, fecha, hora, estado, servicio:servicios_turno(nombre)')
      .eq('vecino_id', uid).eq('estado', 'confirmado').gte('fecha', h).order('fecha').order('hora').limit(3)
      .then(({ data }) => setTurnos(data ?? []))
    supabase.from('reclamos').select('id, numero, estado, categoria:reclamo_categorias(nombre)')
      .eq('vecino_id', uid).in('estado', ['recibido', 'en_curso']).order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setReclamos(data ?? []))
    supabase.from('inscripciones').select('id, familiar:familiares(nombre), actividad:actividades(nombre, dias, hora_inicio, hora_fin, fecha_evento)')
      .eq('titular_id', uid).eq('estado', 'activa')
      .then(({ data }) => {
        const dow = new Date().getDay()
        setHoy((data ?? []).filter(i => i.actividad && (i.actividad.fecha_evento ? i.actividad.fecha_evento === h : i.actividad.dias?.includes(dow))))
      })
  }, [uid])

  const nombre = (profile?.full_name || '').split(' ')[0]
  return (
    <div className="stack">
      <div className="hello">
        <h1>Hola{nombre ? `, ${nombre}` : ''}</h1>
        <p>{fechaLarga(hoyISO())}</p>
      </div>

      {avisos.map(a => (
        <div key={a.id} className={'alert alert-' + (a.tipo === 'alerta' ? 'warn' : 'info')}>
          <b>{a.titulo}</b>{a.cuerpo && <> {a.cuerpo}</>}
          {a.enlace && <> <a href={a.enlace} target="_blank" rel="noreferrer">Más información</a></>}
        </div>
      ))}
      <AvisoCuota />

      <nav className="quick" aria-label="Accesos rápidos">
        {ACCESOS.map(a => (
          <Link key={a.to} to={a.to}>
            <span className={'q-icon' + (a.ocre ? ' ocre' : '')}><Icon name={a.icon} /></span>
            <strong>{a.t}</strong>
            <span className="small">{a.d}</span>
          </Link>
        ))}
      </nav>

      {(hoy.length > 0 || turnos.length > 0 || reclamos.length > 0) && (
        <div className="grid-3">
          {hoy.length > 0 && (
            <section className="card">
              <h2>Hoy tenés</h2>
              <ul className="list">{hoy.map(i => (
                <li key={i.id} className="list-item">
                  <b>{i.actividad.nombre}</b>
                  <div className="small muted">{horarioTexto(i.actividad)}{i.familiar ? ` · ${i.familiar.nombre}` : ''}</div>
                </li>))}
              </ul>
            </section>
          )}
          {turnos.length > 0 && (
            <section className="card">
              <h2>Próximos turnos</h2>
              <ul className="list">{turnos.map(t => (
                <li key={t.id} className="list-item">
                  <b>{t.servicio?.nombre}</b>
                  <div className="small muted">{fechaLarga(t.fecha)}, {hora(t.hora)} h</div>
                </li>))}
              </ul>
              <Link to="/turnos" className="link-btn">Ver turnos</Link>
            </section>
          )}
          {reclamos.length > 0 && (
            <section className="card">
              <h2>Reclamos abiertos</h2>
              <ul className="list">{reclamos.map(r => (
                <li key={r.id} className="list-item row-between">
                  <span><span className="ticket-num">N° {r.numero}</span> {r.categoria?.nombre}</span>
                  <Estado tipo="reclamo" valor={r.estado} />
                </li>))}
              </ul>
              <Link to="/reclamos" className="link-btn">Ver reclamos</Link>
            </section>
          )}
        </div>
      )}

      <section className="card">
        <h2>Teléfonos útiles</h2>
        <div className="phones">
          {TELEFONOS_UTILES.map(t => (
            <a key={t.tel} className="phone" href={telHref(t.tel)}><span>{t.nombre}</span><strong>{t.tel}</strong></a>
          ))}
        </div>
      </section>
    </div>
  )
}

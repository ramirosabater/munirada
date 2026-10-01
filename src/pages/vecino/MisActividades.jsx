import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { horarioTexto, precioTexto, participante, errorTexto } from '../../lib/formato'
import { areaColor } from '../../lib/municipio'
import Estado, { Vacio, Mensaje } from '../../components/Estado'

export default function MisActividades() {
  const { uid } = useAuth()
  const [insc, setInsc] = useState([])
  const [asis, setAsis] = useState({})
  const [msg, setMsg] = useState(null)
  const [verBajas, setVerBajas] = useState(false)

  async function load() {
    const { data } = await supabase.from('inscripciones')
      .select('*, titular:profiles!titular_id(full_name), familiar:familiares(nombre), actividad:actividades(*, sede:sedes(nombre))')
      .eq('titular_id', uid).order('created_at', { ascending: false })
    setInsc(data ?? [])
    const { data: a } = await supabase.from('asistencias').select('inscripcion_id, presente')
      .in('inscripcion_id', (data ?? []).map(i => i.id))
    const res = {}
    for (const x of a ?? []) {
      res[x.inscripcion_id] ??= { p: 0, t: 0 }
      res[x.inscripcion_id].t++; if (x.presente) res[x.inscripcion_id].p++
    }
    setAsis(res)
  }
  useEffect(() => { load() }, [])

  async function baja(i) {
    if (!window.confirm(`¿Dar de baja a ${participante(i)} de ${i.actividad?.nombre}?`)) return
    const { error } = await supabase.from('inscripciones').update({ estado: 'baja' }).eq('id', i.id)
    setMsg(error ? { type: 'error', text: errorTexto(error) } : { type: 'ok', text: 'Listo, quedó dada la baja.' })
    load()
  }

  const vigentes = insc.filter(i => !['baja', 'rechazada'].includes(i.estado))
  const pasadas = insc.filter(i => ['baja', 'rechazada'].includes(i.estado))

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Mis inscripciones</h1><p>Tuyas y de tu grupo familiar.</p></div>
        <Link to="/actividades" className="btn btn-primary">Buscar actividades</Link>
      </div>
      <Mensaje msg={msg} />
      {vigentes.length === 0 && <section className="card"><Vacio titulo="Todavía no te inscribiste a nada">
        <p>Mirá las <Link to="/actividades">actividades disponibles</Link>.</p></Vacio></section>}
      <div className="act-list">
        {vigentes.map(i => {
          const a = i.actividad || {}
          const s = asis[i.id]
          return (
            <article key={i.id} className="act" style={{ '--area': areaColor(a.area) }}>
              <div className="row-between"><h3>{a.nombre}</h3><Estado tipo="inscripcion" valor={i.estado} /></div>
              <dl className="meta">
                <dt>Quién</dt><dd>{participante(i)}</dd>
                <dt>Cuándo</dt><dd>{horarioTexto(a)}</dd>
                {a.sede && <><dt>Dónde</dt><dd>{a.sede.nombre}</dd></>}
                <dt>Cuota</dt><dd>{precioTexto(a)}</dd>
                {s && <><dt>Asistencia</dt><dd>{s.p} de {s.t} clases ({Math.round((s.p / s.t) * 100)}%)</dd></>}
              </dl>
              <div className="foot">
                {i.estado === 'activa' && Number(a.cuota) > 0 ? <Link to="/pagos" className="btn btn-sm btn-primary">Pagar cuota</Link> : <span />}
                <button className="link-btn danger" onClick={() => baja(i)}>Dar de baja</button>
              </div>
            </article>
          )
        })}
      </div>
      {pasadas.length > 0 && (
        <section className="card">
          <button className="link-btn" onClick={() => setVerBajas(v => !v)}>{verBajas ? 'Ocultar' : 'Ver'} inscripciones anteriores ({pasadas.length})</button>
          {verBajas && <ul className="list">{pasadas.map(i => (
            <li key={i.id} className="list-item row-between">
              <span>{i.actividad?.nombre} <span className="muted small">· {participante(i)}</span></span>
              <Estado tipo="inscripcion" valor={i.estado} />
            </li>))}</ul>}
        </section>
      )}
    </div>
  )
}

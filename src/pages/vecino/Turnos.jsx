import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { DIAS, isoLocal, hoyISO, hora, fechaLarga, errorTexto, diasTexto } from '../../lib/formato'
import Estado, { Vacio, Mensaje } from '../../components/Estado'
import Icon from '../../components/Icon'

const aMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const aHora = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export default function Turnos() {
  const { uid } = useAuth()
  const [servicios, setServicios] = useState([])
  const [mis, setMis] = useState([])
  const [sel, setSel] = useState(null)
  const [fecha, setFecha] = useState('')
  const [slot, setSlot] = useState('')
  const [notas, setNotas] = useState('')
  const [ocupados, setOcupados] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function loadMis() {
    const { data } = await supabase.from('turnos')
      .select('*, servicio:servicios_turno(nombre, requisitos, sede:sedes(nombre, direccion))')
      .eq('vecino_id', uid).gte('fecha', hoyISO()).order('fecha').order('hora')
    setMis(data ?? [])
  }
  useEffect(() => {
    supabase.from('servicios_turno').select('*, sede:sedes(nombre, direccion)').eq('activo', true).order('nombre')
      .then(({ data }) => setServicios(data ?? []))
    loadMis()
  }, [])

  // Próximos días hábiles para el servicio elegido
  const fechas = useMemo(() => {
    if (!sel) return []
    const out = []; const d = new Date()
    for (let i = 0; i <= sel.dias_anticipacion && out.length < 21; i++) {
      const x = new Date(d); x.setDate(d.getDate() + i)
      if (sel.dias.includes(x.getDay())) out.push(isoLocal(x))
    }
    return out
  }, [sel])

  useEffect(() => {
    if (!sel || !fechas.length) return
    supabase.rpc('turnos_ocupados', { p_servicio: sel.id, p_desde: fechas[0], p_hasta: fechas[fechas.length - 1] })
      .then(({ data }) => setOcupados(Object.fromEntries((data ?? []).map(o => [`${o.fecha} ${hora(o.hora)}`, Number(o.cantidad)]))))
  }, [sel, fechas])

  const slots = useMemo(() => {
    if (!sel || !fecha) return []
    const out = []; const ahora = new Date()
    const minAhora = fecha === hoyISO() ? ahora.getHours() * 60 + ahora.getMinutes() + 30 : -1
    for (let m = aMin(sel.hora_desde); m < aMin(sel.hora_hasta); m += sel.duracion_min) {
      const h = aHora(m)
      out.push({ h, lleno: (ocupados[`${fecha} ${h}`] || 0) >= sel.cupo_por_turno || m < minAhora })
    }
    return out
  }, [sel, fecha, ocupados])

  function elegirServicio(s) { setSel(s); setFecha(''); setSlot(''); setNotas(''); setMsg(null) }

  async function confirmar() {
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('turnos').insert({ servicio_id: sel.id, vecino_id: uid, fecha, hora: slot, notas: notas || null })
    setBusy(false)
    if (error) return setMsg({ type: 'error', text: errorTexto(error) })
    setMsg({ type: 'ok', text: `Turno confirmado: ${sel.nombre}, ${fechaLarga(fecha)} a las ${slot} h.` })
    setSel(null); loadMis()
  }

  async function cancelar(t) {
    if (!window.confirm(`¿Cancelar el turno de ${t.servicio?.nombre} del ${fechaLarga(t.fecha)}?`)) return
    const { error } = await supabase.from('turnos').update({ estado: 'cancelado' }).eq('id', t.id)
    setMsg(error ? { type: 'error', text: errorTexto(error) } : { type: 'ok', text: 'Turno cancelado. El horario queda libre para otra persona.' })
    loadMis()
  }

  const proximos = mis.filter(t => t.estado === 'confirmado')
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Turnos</h1><p>Reservá día y horario sin hacer fila.</p></div></div>
      <Mensaje msg={msg} />

      {proximos.length > 0 && (
        <section className="card">
          <h2>Tus próximos turnos</h2>
          <ul className="list">{proximos.map(t => (
            <li key={t.id} className="list-item row-between">
              <div>
                <b>{t.servicio?.nombre}</b> <Estado tipo="turno" valor={t.estado} />
                <div>{fechaLarga(t.fecha)}, {hora(t.hora)} h</div>
                {t.servicio?.sede && <div className="small muted">{t.servicio.sede.nombre}{t.servicio.sede.direccion ? `, ${t.servicio.sede.direccion}` : ''}</div>}
                {t.servicio?.requisitos && <div className="small muted">{t.servicio.requisitos}</div>}
              </div>
              <button className="link-btn danger" onClick={() => cancelar(t)}>Cancelar</button>
            </li>))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Sacar un turno</h2>
        {servicios.length === 0 && <Vacio titulo="No hay servicios con turnos por ahora" />}
        <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {servicios.map(s => (
            <button key={s.id} className={'cat' + (sel?.id === s.id ? ' on' : '')} onClick={() => elegirServicio(s)} aria-pressed={sel?.id === s.id}>
              {s.nombre}
              <div className="small muted" style={{ fontWeight: 400 }}>{diasTexto(s.dias)}, {hora(s.hora_desde)} a {hora(s.hora_hasta)} h</div>
            </button>
          ))}
          <a className="cat" href="https://turnero.radatilly.gob.ar/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
            Licencia de conducir <Icon name="externo" size={14} />
            <div className="small muted" style={{ fontWeight: 400 }}>En el turnero municipal</div>
          </a>
        </div>

        {sel && (
          <div className="form" style={{ marginTop: '1.1rem' }}>
            {sel.descripcion && <p className="muted" style={{ margin: 0 }}>{sel.descripcion}</p>}
            {sel.requisitos && <div className="alert alert-info">{sel.requisitos}</div>}
            <div>
              <span className="field-label">Elegí el día</span>
              <div className="days">{fechas.map(f => {
                const d = new Date(f + 'T00:00:00')
                return (
                  <button key={f} className={'day' + (fecha === f ? ' on' : '')} onClick={() => { setFecha(f); setSlot('') }}>
                    <small>{DIAS.find(x => x.n === d.getDay()).c}</small><b>{d.getDate()}</b>
                    <small>{d.toLocaleDateString('es-AR', { month: 'short' })}</small>
                  </button>)
              })}</div>
            </div>
            {fecha && (
              <div>
                <span className="field-label">Elegí el horario · {fechaLarga(fecha)}</span>
                <div className="slots">{slots.map(s => (
                  <button key={s.h} className={'slot' + (slot === s.h ? ' on' : '')} disabled={s.lleno} onClick={() => setSlot(s.h)}>{s.h}</button>
                ))}</div>
                {slots.every(s => s.lleno) && <p className="hint">No quedan horarios este día. Probá con otro.</p>}
              </div>
            )}
            {slot && (
              <>
                {sel.pide_notas && <label>{sel.pide_notas}
                  <textarea value={notas} onChange={e => setNotas(e.target.value)} required style={{ minHeight: 70 }} /></label>}
                <button className="btn btn-primary" disabled={busy || (sel.pide_notas && !notas.trim())} onClick={confirmar}>
                  {busy ? 'Reservando…' : `Confirmar turno, ${fechaLarga(fecha)} a las ${slot} h`}</button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

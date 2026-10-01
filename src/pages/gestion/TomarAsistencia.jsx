import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { hoyISO, isoLocal, fechaLarga, participante, calcularEdad, errorTexto, descargarCSV } from '../../lib/formato'
import { Vacio, Mensaje } from '../../components/Estado'

function ultimaFecha(dias) {
  const hoy = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoy); d.setDate(hoy.getDate() - i)
    if (dias?.includes(d.getDay())) return isoLocal(d)
  }
  return hoyISO()
}

export default function TomarAsistencia() {
  const { uid, profile } = useAuth()
  const [params] = useSearchParams()
  const [acts, setActs] = useState([])
  const [actId, setActId] = useState(params.get('actividad') || '')
  const [fecha, setFecha] = useState(hoyISO())
  const [lista, setLista] = useState([])
  const [presente, setPresente] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let q = supabase.from('actividades').select('id, nombre, dias, fecha_evento').eq('activa', true).order('nombre')
    if (profile.role === 'profesor') q = q.eq('profesor_id', uid)
    else if (profile.role === 'agente') q = q.eq('area', profile.area)
    q.then(({ data }) => {
      setActs(data ?? [])
      const a = (data ?? []).find(x => x.id === actId)
      if (a) setFecha(a.fecha_evento || ultimaFecha(a.dias))
    })
  }, [])

  function elegir(id) {
    setActId(id)
    const a = acts.find(x => x.id === id)
    if (a) setFecha(a.fecha_evento || ultimaFecha(a.dias))
  }

  useEffect(() => {
    if (!actId) return setLista([])
    async function cargar() {
      const { data: insc } = await supabase.from('inscripciones')
        .select('id, titular:profiles!titular_id(full_name, fecha_nacimiento), familiar:familiares(nombre, fecha_nacimiento)')
        .eq('actividad_id', actId).eq('estado', 'activa')
      const ordenados = (insc ?? []).sort((a, b) => participante(a).localeCompare(participante(b)))
      setLista(ordenados)
      const { data: as } = await supabase.from('asistencias').select('inscripcion_id, presente').eq('actividad_id', actId).eq('fecha', fecha)
      const prev = Object.fromEntries((as ?? []).map(a => [a.inscripcion_id, a.presente]))
      setPresente(Object.fromEntries(ordenados.map(i => [i.id, prev[i.id] ?? false])))
      setMsg(as?.length ? { type: 'info', text: 'Esta fecha ya tiene asistencia cargada. Podés corregirla y volver a guardar.' } : null)
    }
    cargar()
  }, [actId, fecha])

  async function guardar() {
    setBusy(true); setMsg(null)
    const filas = lista.map(i => ({ actividad_id: actId, inscripcion_id: i.id, fecha, presente: !!presente[i.id], tomado_por: uid }))
    const { error } = await supabase.from('asistencias').upsert(filas, { onConflict: 'inscripcion_id,fecha' })
    setBusy(false)
    const n = filas.filter(f => f.presente).length
    setMsg(error ? { type: 'error', text: errorTexto(error) } : { type: 'ok', text: `Asistencia guardada: ${n} de ${filas.length} presentes.` })
  }

  async function exportarMes() {
    const mes = fecha.slice(0, 7)
    const { data } = await supabase.from('asistencias').select('fecha, presente, inscripcion_id')
      .eq('actividad_id', actId).gte('fecha', mes + '-01').lte('fecha', mes + '-31').order('fecha')
    const fechas = [...new Set((data ?? []).map(d => d.fecha))]
    const filas = [['Participante', ...fechas, 'Presentes']]
    for (const i of lista) {
      const marcas = fechas.map(f => { const r = data.find(d => d.fecha === f && d.inscripcion_id === i.id); return r ? (r.presente ? 'P' : 'A') : '' })
      filas.push([participante(i), ...marcas, marcas.filter(m => m === 'P').length])
    }
    descargarCSV(`asistencia-${acts.find(a => a.id === actId)?.nombre}-${mes}.csv`, filas)
  }

  const act = acts.find(a => a.id === actId)
  const fueraDeDia = act && !act.fecha_evento && act.dias?.length && !act.dias.includes(new Date(fecha + 'T00:00:00').getDay())
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Asistencia</h1><p>Marcá quién vino a la clase.</p></div></div>
      <section className="card">
        <div className="grid-2">
          <label>Actividad<select value={actId} onChange={e => elegir(e.target.value)}>
            <option value="">Elegí una…</option>{acts.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
          <label>Fecha<input type="date" value={fecha} max={hoyISO()} onChange={e => setFecha(e.target.value)} /></label>
        </div>
        {fueraDeDia && <p className="hint">Ojo: {fechaLarga(fecha)} no es un día habitual de esta actividad.</p>}
      </section>

      {actId && (
        <section className="card">
          <div className="row-between">
            <h2>{act?.nombre} · {fechaLarga(fecha)}</h2>
            {lista.length > 0 && <div className="row-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setPresente(Object.fromEntries(lista.map(i => [i.id, true])))}>Todos presentes</button>
              <button className="btn btn-ghost btn-sm" onClick={exportarMes}>Planilla del mes</button></div>}
          </div>
          {lista.length === 0 ? <Vacio titulo="No hay inscriptos activos" /> : (
            <>
              <div>{lista.map(i => (
                <div key={i.id} className="roster-row">
                  <span>{participante(i)} <span className="small muted">{calcularEdad((i.familiar ?? i.titular)?.fecha_nacimiento) ?? ''}{(i.familiar ?? i.titular)?.fecha_nacimiento ? ' años' : ''}</span></span>
                  <button className={'toggle' + (presente[i.id] ? ' on' : '')} aria-pressed={!!presente[i.id]}
                    onClick={() => setPresente(p => ({ ...p, [i.id]: !p[i.id] }))}>{presente[i.id] ? 'Presente' : 'Ausente'}</button>
                </div>))}
              </div>
              <div className="row-between" style={{ marginTop: '1rem' }}>
                <span className="muted">{Object.values(presente).filter(Boolean).length} de {lista.length} presentes</span>
                <button className="btn btn-primary" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar asistencia'}</button>
              </div>
            </>
          )}
          <div style={{ marginTop: '0.8rem' }}><Mensaje msg={msg} /></div>
        </section>
      )}
    </div>
  )
}

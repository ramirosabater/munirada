import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { AREAS } from '../../lib/municipio'
import { DIAS, isoLocal, hoyISO, hora, fechaLarga, diasTexto, errorTexto, descargarCSV } from '../../lib/formato'
import Estado, { Vacio, Mensaje } from '../../components/Estado'

const VACIO = { nombre: '', descripcion: '', requisitos: '', area: '', sede_id: '', dias: [1, 2, 3, 4, 5], hora_desde: '08:00',
  hora_hasta: '13:00', duracion_min: 30, cupo_por_turno: 1, dias_anticipacion: 30, pide_notas: '', activo: true }

export default function GestionTurnos() {
  const { profile, isAdmin } = useAuth()
  const [vista, setVista] = useState('agenda')
  const [servicios, setServicios] = useState([])
  const [sedes, setSedes] = useState([])
  const [fecha, setFecha] = useState(hoyISO())
  const [fServ, setFServ] = useState('')
  const [turnos, setTurnos] = useState([])
  const [form, setForm] = useState(null)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)

  async function loadServicios() {
    let q = supabase.from('servicios_turno').select('*, sede:sedes(nombre)').order('nombre')
    if (!isAdmin) q = q.eq('area', profile.area)
    const { data } = await q
    setServicios(data ?? [])
  }
  async function loadTurnos() {
    let q = supabase.from('turnos').select('*, servicio:servicios_turno(nombre), vecino:profiles!vecino_id(full_name, dni, telefono)')
      .eq('fecha', fecha).order('hora')
    if (fServ) q = q.eq('servicio_id', fServ)
    const { data } = await q
    setTurnos(data ?? [])
  }
  useEffect(() => { loadServicios(); supabase.from('sedes').select('*').order('nombre').then(({ data }) => setSedes(data ?? [])) }, [])
  useEffect(() => { loadTurnos() }, [fecha, fServ])

  async function marcar(t, estado) {
    const { error } = await supabase.from('turnos').update({ estado }).eq('id', t.id)
    if (error) setMsg({ type: 'error', text: errorTexto(error) })
    loadTurnos()
  }
  function mover(dias) { const d = new Date(fecha + 'T00:00:00'); d.setDate(d.getDate() + dias); setFecha(isoLocal(d)) }

  function editar(s) {
    setEditId(s?.id ?? null)
    setForm(s ? { ...VACIO, ...Object.fromEntries(Object.keys(VACIO).map(k => [k, s[k] ?? VACIO[k]])), hora_desde: hora(s.hora_desde), hora_hasta: hora(s.hora_hasta) }
      : { ...VACIO, area: isAdmin ? 'ambiente' : profile.area })
    setMsg(null)
  }
  async function guardar(e) {
    e.preventDefault()
    const datos = { ...form, sede_id: form.sede_id || null, duracion_min: Number(form.duracion_min), cupo_por_turno: Number(form.cupo_por_turno),
      dias_anticipacion: Number(form.dias_anticipacion), pide_notas: form.pide_notas || null }
    const { error } = editId ? await supabase.from('servicios_turno').update(datos).eq('id', editId) : await supabase.from('servicios_turno').insert(datos)
    if (error) return setMsg({ type: 'error', text: errorTexto(error) })
    setMsg({ type: 'ok', text: 'Servicio guardado.' }); setForm(null); loadServicios()
  }
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleDia = n => setForm(f => ({ ...f, dias: f.dias.includes(n) ? f.dias.filter(x => x !== n) : [...f.dias, n] }))

  function exportar() {
    descargarCSV(`turnos-${fecha}.csv`, [['Hora', 'Servicio', 'Vecino/a', 'DNI', 'Teléfono', 'Notas', 'Estado'],
      ...turnos.map(t => [hora(t.hora), t.servicio?.nombre, t.vecino?.full_name, t.vecino?.dni, t.vecino?.telefono, t.notas, t.estado])])
  }

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Turnos</h1><p>Agenda del día y configuración de los servicios.</p></div>
        <div className="chips">
          <button className={'chip' + (vista === 'agenda' ? ' on' : '')} onClick={() => setVista('agenda')}>Agenda</button>
          <button className={'chip' + (vista === 'servicios' ? ' on' : '')} onClick={() => setVista('servicios')}>Servicios</button>
        </div></div>
      <Mensaje msg={msg} />

      {vista === 'agenda' && (
        <section className="card">
          <div className="row-between" style={{ marginBottom: '0.8rem' }}>
            <div className="row">
              <button className="btn btn-ghost btn-sm" onClick={() => mover(-1)} aria-label="Día anterior">‹</button>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ width: 'auto' }} aria-label="Fecha" />
              <button className="btn btn-ghost btn-sm" onClick={() => mover(1)} aria-label="Día siguiente">›</button>
              <b>{fechaLarga(fecha)}</b>
            </div>
            <div className="row">
              <select value={fServ} onChange={e => setFServ(e.target.value)} style={{ width: 'auto' }} aria-label="Servicio">
                <option value="">Todos los servicios</option>{servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
              {turnos.length > 0 && <button className="btn btn-ghost btn-sm" onClick={exportar}>Descargar</button>}
            </div>
          </div>
          {turnos.length === 0 ? <Vacio titulo="Sin turnos para este día" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Hora</th><th>Vecino/a</th><th>Servicio</th><th>Notas</th><th>Estado</th><th></th></tr></thead>
              <tbody>{turnos.map(t => (
                <tr key={t.id}>
                  <td className="num"><b>{hora(t.hora)}</b></td>
                  <td><b>{t.vecino?.full_name}</b><div className="small muted">DNI {t.vecino?.dni || '—'} · {t.vecino?.telefono || '—'}</div></td>
                  <td>{t.servicio?.nombre}</td>
                  <td className="small">{t.notas || '—'}</td>
                  <td><Estado tipo="turno" valor={t.estado} /></td>
                  <td className="row-actions">{t.estado === 'confirmado' && <>
                    <button className="btn btn-sm btn-ok" onClick={() => marcar(t, 'atendido')}>Atendido</button>
                    <button className="btn btn-sm btn-off" onClick={() => marcar(t, 'ausente')}>Ausente</button>
                    <button className="link-btn danger" onClick={() => marcar(t, 'cancelado')}>Cancelar</button></>}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {vista === 'servicios' && (
        <>
          {!form && <div><button className="btn btn-primary" onClick={() => editar(null)}>Nuevo servicio</button></div>}
          {form && (
            <section className="card">
              <div className="row-between"><h2>{editId ? 'Editar servicio' : 'Nuevo servicio'}</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setForm(null)}>Cerrar</button></div>
              <form onSubmit={guardar} className="form">
                <div className="grid-2">
                  <label>Nombre<input value={form.nombre} onChange={e => up('nombre', e.target.value)} required /></label>
                  <label>Área<select value={form.area} onChange={e => up('area', e.target.value)} disabled={!isAdmin}>
                    {Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                </div>
                <label>Descripción<input value={form.descripcion ?? ''} onChange={e => up('descripcion', e.target.value)} /></label>
                <label>Requisitos e indicaciones<textarea value={form.requisitos ?? ''} onChange={e => up('requisitos', e.target.value)} style={{ minHeight: 70 }} /></label>
                <label>Sede<select value={form.sede_id ?? ''} onChange={e => up('sede_id', e.target.value)}>
                  <option value="">A confirmar</option>{sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
                <div><span className="field-label">Días de atención</span>
                  <div className="chips">{DIAS.map(d => <button type="button" key={d.n} className={'chip' + (form.dias.includes(d.n) ? ' on' : '')} onClick={() => toggleDia(d.n)}>{d.c}</button>)}</div></div>
                <div className="grid-3">
                  <label>Desde<input type="time" value={form.hora_desde} onChange={e => up('hora_desde', e.target.value)} required /></label>
                  <label>Hasta<input type="time" value={form.hora_hasta} onChange={e => up('hora_hasta', e.target.value)} required /></label>
                  <label>Minutos por turno<input type="number" min="5" step="5" value={form.duracion_min} onChange={e => up('duracion_min', e.target.value)} required /></label>
                </div>
                <div className="grid-3">
                  <label>Personas por horario<input type="number" min="1" value={form.cupo_por_turno} onChange={e => up('cupo_por_turno', e.target.value)} required /></label>
                  <label>Días de anticipación<input type="number" min="1" value={form.dias_anticipacion} onChange={e => up('dias_anticipacion', e.target.value)} required /></label>
                  <label>Pedir al vecino<input value={form.pide_notas ?? ''} onChange={e => up('pide_notas', e.target.value)} placeholder="Ej. Datos de la mascota" /></label>
                </div>
                <label className="checkbox"><input type="checkbox" checked={form.activo} onChange={e => up('activo', e.target.checked)} /> Tomando turnos</label>
                <div><button className="btn btn-primary">Guardar servicio</button></div>
              </form>
            </section>
          )}
          <section className="card">
            {servicios.length === 0 ? <Vacio titulo="No hay servicios configurados" /> : (
              <ul className="list">{servicios.map(s => (
                <li key={s.id} className="list-item row-between">
                  <span><b>{s.nombre}</b> {!s.activo && <span className="pill pill-mute">Pausado</span>}
                    <div className="small muted">{AREAS[s.area]} · {diasTexto(s.dias)}, {hora(s.hora_desde)} a {hora(s.hora_hasta)} h · {s.duracion_min} min · {s.cupo_por_turno} por horario</div></span>
                  <button className="link-btn" onClick={() => editar(s)}>Editar</button>
                </li>))}</ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

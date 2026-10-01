import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { AREAS, AREAS_ACTIVIDADES } from '../../lib/municipio'
import { DIAS, horarioTexto, precioTexto, participante, calcularEdad, descargarCSV, errorTexto, hora } from '../../lib/formato'
import Estado, { Vacio, Mensaje } from '../../components/Estado'

const VACIO = {
  nombre: '', descripcion: '', area: 'deportes', publico: '', sede_id: '', docente: '', profesor_id: '',
  dias: [], hora_inicio: '', hora_fin: '', fecha_evento: '', edad_min: '', edad_max: '', cupo: '',
  cuota: '0', modalidad_pago: 'mensual', requiere_aprobacion: false, inscripcion_abierta: true, activa: true,
}
const nulo = v => (v === '' || v == null ? null : v)

export default function GestionActividades() {
  const { profile, uid, isAdmin, gestiona } = useAuth()
  const [acts, setActs] = useState([])
  const [sedes, setSedes] = useState([])
  const [profes, setProfes] = useState([])
  const [form, setForm] = useState(VACIO)
  const [editId, setEditId] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [msg, setMsg] = useState(null)
  const [sel, setSel] = useState(null)
  const [insc, setInsc] = useState([])
  const [buscarVec, setBuscarVec] = useState('')
  const [vecinos, setVecinos] = useState([])
  const [nuevaSede, setNuevaSede] = useState('')

  const areasPropias = isAdmin ? AREAS_ACTIVIDADES : [profile.area].filter(Boolean)
  const puedeCrear = isAdmin || (profile.role === 'agente' && profile.area)

  async function load() {
    let q = supabase.from('actividades').select('*, sede:sedes(nombre), profesor:profiles!profesor_id(full_name)').order('area').order('nombre')
    if (profile.role === 'profesor') q = q.eq('profesor_id', uid)
    else if (profile.role === 'agente') q = q.eq('area', profile.area)
    const [{ data: a }, { data: s }, { data: p }, { data: c }] = await Promise.all([
      q, supabase.from('sedes').select('*').order('nombre'),
      supabase.from('profiles').select('id, full_name, role').in('role', ['profesor', 'agente', 'admin']).order('full_name'),
      supabase.from('inscripciones').select('actividad_id, estado').in('estado', ['activa', 'pendiente', 'espera']),
    ])
    const cuenta = {}
    for (const x of c ?? []) { cuenta[x.actividad_id] ??= { activa: 0, pendiente: 0, espera: 0 }; cuenta[x.actividad_id][x.estado]++ }
    setActs((a ?? []).map(x => ({ ...x, n: cuenta[x.id] ?? { activa: 0, pendiente: 0, espera: 0 } })))
    setSedes(s ?? []); setProfes(p ?? [])
  }
  useEffect(() => { load() }, [])

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleDia = n => setForm(f => ({ ...f, dias: f.dias.includes(n) ? f.dias.filter(x => x !== n) : [...f.dias, n] }))

  function nueva() { setEditId(null); setForm({ ...VACIO, area: areasPropias[0] || 'deportes' }); setAbierto(true); setMsg(null) }
  function editar(a) {
    setEditId(a.id)
    const f = { ...VACIO }
    for (const k of Object.keys(VACIO)) f[k] = a[k] ?? VACIO[k]
    f.hora_inicio = hora(a.hora_inicio); f.hora_fin = hora(a.hora_fin)
    for (const k of ['edad_min', 'edad_max', 'cupo', 'cuota', 'fecha_evento', 'sede_id', 'profesor_id']) f[k] = a[k] == null ? '' : String(a[k])
    setForm(f); setAbierto(true); setMsg(null); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardar(e) {
    e.preventDefault(); setMsg(null)
    const datos = {
      ...form,
      sede_id: nulo(form.sede_id), profesor_id: nulo(form.profesor_id), fecha_evento: nulo(form.fecha_evento),
      hora_inicio: nulo(form.hora_inicio), hora_fin: nulo(form.hora_fin), descripcion: nulo(form.descripcion),
      publico: nulo(form.publico), docente: nulo(form.docente),
      edad_min: nulo(form.edad_min) && Number(form.edad_min), edad_max: nulo(form.edad_max) && Number(form.edad_max),
      cupo: nulo(form.cupo) && Number(form.cupo), cuota: Number(form.cuota) || 0,
    }
    const { error } = editId ? await supabase.from('actividades').update(datos).eq('id', editId)
      : await supabase.from('actividades').insert(datos)
    if (error) return setMsg({ type: 'error', text: errorTexto(error) })
    setMsg({ type: 'ok', text: editId ? 'Actividad actualizada.' : 'Actividad creada.' })
    setAbierto(false); setEditId(null); load()
  }

  async function borrar(a) {
    if (!window.confirm(`¿Eliminar "${a.nombre}"? Se borran sus inscripciones, asistencias y pagos. Si solo querés ocultarla, desmarcá "Activa".`)) return
    const { error } = await supabase.from('actividades').delete().eq('id', a.id)
    if (error) setMsg({ type: 'error', text: errorTexto(error) })
    if (sel?.id === a.id) setSel(null)
    load()
  }

  async function agregarSede() {
    if (!nuevaSede.trim()) return
    const { data, error } = await supabase.from('sedes').insert({ nombre: nuevaSede.trim() }).select().single()
    if (error) return setMsg({ type: 'error', text: errorTexto(error) })
    setNuevaSede(''); setSedes(s => [...s, data].sort((x, y) => x.nombre.localeCompare(y.nombre))); up('sede_id', data.id)
  }

  async function verInscriptos(a) {
    setSel(a); setBuscarVec(''); setVecinos([])
    const { data } = await supabase.from('inscripciones')
      .select('*, titular:profiles!titular_id(full_name, dni, telefono, fecha_nacimiento), familiar:familiares(nombre, dni, fecha_nacimiento)')
      .eq('actividad_id', a.id).order('created_at')
    setInsc(data ?? [])
    setTimeout(() => document.getElementById('inscriptos')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }
  async function cambiarEstado(i, estado) {
    const { error } = await supabase.from('inscripciones').update({ estado }).eq('id', i.id)
    if (error) setMsg({ type: 'error', text: errorTexto(error) })
    verInscriptos(sel); load()
  }
  async function buscarVecinos(t) {
    setBuscarVec(t)
    const q = t.replace(/[,()%*]/g, ' ').trim()
    if (q.length < 3) return setVecinos([])
    const { data } = await supabase.from('profiles').select('id, full_name, dni')
      .or(`full_name.ilike.%${q}%,dni.ilike.%${q}%`).eq('activo', true).limit(8)
    setVecinos(data ?? [])
  }
  async function inscribirVecino(v) {
    const { error } = await supabase.from('inscripciones').insert({ actividad_id: sel.id, titular_id: v.id, estado: 'activa' })
    if (error) setMsg({ type: 'error', text: errorTexto(error) })
    setBuscarVec(''); setVecinos([]); verInscriptos(sel); load()
  }
  function exportar() {
    const filas = [['Participante', 'DNI', 'Edad', 'Titular', 'Teléfono', 'Estado', 'Alta']]
    for (const i of insc) {
      const p = i.familiar ?? i.titular
      filas.push([participante(i), p?.dni, calcularEdad(p?.fecha_nacimiento), i.titular?.full_name, i.titular?.telefono, i.estado, i.created_at?.slice(0, 10)])
    }
    descargarCSV(`inscriptos-${sel.nombre}.csv`, filas)
  }

  const editable = sel && gestiona(sel.area)
  const orden = { activa: 0, pendiente: 1, espera: 2, baja: 3, rechazada: 4 }
  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>{profile.role === 'profesor' ? 'Mis grupos' : 'Actividades'}</h1>
          <p>{profile.role === 'profesor' ? 'Inscriptos de las actividades a tu cargo.' : 'Talleres, deportes y eventos con inscripción.'}</p></div>
        {puedeCrear && !abierto && <button className="btn btn-primary" onClick={nueva}>Nueva actividad</button>}
      </div>
      {!abierto && <Mensaje msg={msg} />}

      {abierto && (
        <section className="card">
          <div className="row-between"><h2>{editId ? 'Editar actividad' : 'Nueva actividad'}</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setAbierto(false)}>Cerrar</button></div>
          <form onSubmit={guardar} className="form">
            <div className="grid-2">
              <label>Nombre<input value={form.nombre} onChange={e => up('nombre', e.target.value)} required /></label>
              <label>Área<select value={form.area} onChange={e => up('area', e.target.value)} disabled={!isAdmin}>
                {(isAdmin ? Object.keys(AREAS) : areasPropias).map(a => <option key={a} value={a}>{AREAS[a]}</option>)}</select></label>
            </div>
            <label>Descripción<textarea value={form.descripcion} onChange={e => up('descripcion', e.target.value)} style={{ minHeight: 70 }} /></label>
            <div className="grid-3">
              <label>Público<input value={form.publico} onChange={e => up('publico', e.target.value)} placeholder="Adultos, Infancias…" list="publicos" />
                <datalist id="publicos">{['Adultos', 'Menores', 'Infancias', 'Adultos mayores', 'Todo público', 'Adultos y jóvenes'].map(p => <option key={p} value={p} />)}</datalist></label>
              <label>Edad mínima<input type="number" min="0" value={form.edad_min} onChange={e => up('edad_min', e.target.value)} /></label>
              <label>Edad máxima<input type="number" min="0" value={form.edad_max} onChange={e => up('edad_max', e.target.value)} /></label>
            </div>
            <div className="grid-2">
              <label>Sede<select value={form.sede_id} onChange={e => up('sede_id', e.target.value)}>
                <option value="">Sin sede</option>{sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
              <div><span className="field-label">¿Otra sede?</span>
                <div className="row"><input value={nuevaSede} onChange={e => setNuevaSede(e.target.value)} placeholder="Nombre de la sede" style={{ flex: 1 }} aria-label="Nueva sede" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={agregarSede}>Agregar</button></div></div>
            </div>
            <div className="grid-2">
              <label>Docente (como se muestra)<input value={form.docente} onChange={e => up('docente', e.target.value)} /></label>
              <label>Usuario que toma asistencia<select value={form.profesor_id} onChange={e => up('profesor_id', e.target.value)}>
                <option value="">Sin asignar</option>{profes.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
            </div>
            <label>Fecha (solo si es un evento de un día)
              <input type="date" value={form.fecha_evento} onChange={e => up('fecha_evento', e.target.value)} /></label>
            {!form.fecha_evento && (
              <div><span className="field-label">Días</span>
                <div className="chips">{DIAS.map(d => (
                  <button type="button" key={d.n} className={'chip' + (form.dias.includes(d.n) ? ' on' : '')} onClick={() => toggleDia(d.n)}>{d.c}</button>))}
                </div></div>
            )}
            <div className="grid-3">
              <label>Hora de inicio<input type="time" value={form.hora_inicio} onChange={e => up('hora_inicio', e.target.value)} /></label>
              <label>Hora de fin<input type="time" value={form.hora_fin} onChange={e => up('hora_fin', e.target.value)} /></label>
              <label>Cupo (vacío = sin límite)<input type="number" min="1" value={form.cupo} onChange={e => up('cupo', e.target.value)} /></label>
            </div>
            <div className="grid-2">
              <label>Cuota ($, 0 = gratuita)<input type="number" min="0" step="0.01" value={form.cuota} onChange={e => up('cuota', e.target.value)} /></label>
              <label>Se paga<select value={form.modalidad_pago} onChange={e => up('modalidad_pago', e.target.value)}>
                <option value="mensual">Todos los meses</option><option value="unica">Una sola vez</option></select></label>
            </div>
            <label className="checkbox"><input type="checkbox" checked={form.requiere_aprobacion} onChange={e => up('requiere_aprobacion', e.target.checked)} />
              Las inscripciones requieren aprobación del área</label>
            <label className="checkbox"><input type="checkbox" checked={form.inscripcion_abierta} onChange={e => up('inscripcion_abierta', e.target.checked)} />
              Inscripción abierta</label>
            <label className="checkbox"><input type="checkbox" checked={form.activa} onChange={e => up('activa', e.target.checked)} />
              Activa (visible para los vecinos)</label>
            <Mensaje msg={msg} />
            <div className="row-actions"><button className="btn btn-primary">{editId ? 'Guardar cambios' : 'Crear actividad'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setAbierto(false)}>Cancelar</button></div>
          </form>
        </section>
      )}

      <section className="card">
        {acts.length === 0 ? <Vacio titulo="No hay actividades para mostrar" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Actividad</th><th>Horario</th><th>Cuota</th><th>Inscriptos</th><th>Estado</th><th></th></tr></thead>
            <tbody>{acts.map(a => (
              <tr key={a.id}>
                <td><b>{a.nombre}</b><div className="small muted">{AREAS[a.area]}{a.sede ? ` · ${a.sede.nombre}` : ''}{a.profesor ? ` · ${a.profesor.full_name}` : ''}</div></td>
                <td className="small">{horarioTexto(a)}</td>
                <td className="small nowrap">{precioTexto(a)}</td>
                <td className="num nowrap">{a.n.activa}{a.cupo ? ` / ${a.cupo}` : ''}
                  {(a.n.pendiente + a.n.espera) > 0 && <div><span className="pill pill-warn">{a.n.pendiente + a.n.espera} por revisar</span></div>}</td>
                <td>{a.activa ? (a.inscripcion_abierta ? <span className="pill pill-ok">Abierta</span> : <span className="pill pill-mute">Cerrada</span>) : <span className="pill pill-mute">Oculta</span>}</td>
                <td className="row-actions">
                  <button className="link-btn" onClick={() => verInscriptos(a)}>Inscriptos</button>
                  {gestiona(a.area) && <button className="link-btn" onClick={() => editar(a)}>Editar</button>}
                  {gestiona(a.area) && <button className="link-btn danger" onClick={() => borrar(a)}>Eliminar</button>}
                </td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </section>

      {sel && (
        <section className="card" id="inscriptos">
          <div className="row-between"><h2>Inscriptos · {sel.nombre}</h2>
            <div className="row-actions">
              {insc.length > 0 && <button className="btn btn-ghost btn-sm" onClick={exportar}>Descargar planilla</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setSel(null)}>Cerrar</button></div></div>
          {editable && (
            <div style={{ marginBottom: '0.8rem' }}>
              <input value={buscarVec} onChange={e => buscarVecinos(e.target.value)} placeholder="Inscribir a un vecino: buscá por nombre o DNI" aria-label="Buscar vecino" />
              {vecinos.length > 0 && <ul className="list">{vecinos.map(v => (
                <li key={v.id} className="list-item row-between"><span>{v.full_name} <span className="muted small">{v.dni}</span></span>
                  <button className="btn btn-sm btn-primary" onClick={() => inscribirVecino(v)}>Inscribir</button></li>))}</ul>}
            </div>
          )}
          {insc.length === 0 ? <Vacio titulo="Nadie inscripto todavía" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Participante</th><th>Edad</th><th>Contacto</th><th>Estado</th><th></th></tr></thead>
              <tbody>{[...insc].sort((x, y) => orden[x.estado] - orden[y.estado]).map(i => {
                const p = i.familiar ?? i.titular
                return (
                  <tr key={i.id}>
                    <td><b>{participante(i)}</b>{i.familiar && <div className="small muted">a cargo de {i.titular?.full_name}</div>}</td>
                    <td className="num">{calcularEdad(p?.fecha_nacimiento) ?? '—'}</td>
                    <td className="small">{i.titular?.telefono || '—'}</td>
                    <td><Estado tipo="inscripcion" valor={i.estado} /></td>
                    <td className="row-actions">{editable && <>
                      {i.estado !== 'activa' && <button className="btn btn-sm btn-ok" onClick={() => cambiarEstado(i, 'activa')}>Aceptar</button>}
                      {i.estado === 'pendiente' && <button className="btn btn-sm btn-off" onClick={() => cambiarEstado(i, 'rechazada')}>Rechazar</button>}
                      {i.estado === 'activa' && <button className="link-btn danger" onClick={() => cambiarEstado(i, 'baja')}>Dar de baja</button>}
                    </>}</td>
                  </tr>)
              })}</tbody>
            </table></div>
          )}
        </section>
      )}
    </div>
  )
}

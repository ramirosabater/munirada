import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { METODOS_PAGO } from '../../lib/municipio'
import { mesActual, pesos, periodoTexto, participante, fechaCorta, errorTexto, abrirArchivo, subirArchivo } from '../../lib/formato'
import Estado, { Vacio, Mensaje } from '../../components/Estado'

const MANUAL = () => ({ actividad_id: '', inscripcion_id: '', monto: '', periodo: mesActual(), metodo: 'efectivo' })

export default function RevisarPagos() {
  const { uid, profile } = useAuth()
  const [pagos, setPagos] = useState([])
  const [acts, setActs] = useState([])
  const [fEstado, setFEstado] = useState('pendiente')
  const [fAct, setFAct] = useState('')
  const [fTxt, setFTxt] = useState('')
  const [msg, setMsg] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [m, setM] = useState(MANUAL())
  const [inscAct, setInscAct] = useState([])
  const [file, setFile] = useState(null)

  async function load() {
    let q = supabase.from('pagos')
      .select('*, titular:profiles!titular_id(full_name, dni), actividad:actividades(nombre, area), inscripcion:inscripciones(familiar:familiares(nombre))')
      .order('created_at', { ascending: false }).limit(500)
    if (fEstado) q = q.eq('estado', fEstado)
    if (fAct) q = q.eq('actividad_id', fAct)
    const { data } = await q
    setPagos(data ?? [])
  }
  useEffect(() => {
    let q = supabase.from('actividades').select('id, nombre, cuota').gt('cuota', 0).order('nombre')
    if (profile.role === 'agente') q = q.eq('area', profile.area)
    q.then(({ data }) => setActs(data ?? []))
  }, [])
  useEffect(() => { load() }, [fEstado, fAct])

  async function setEstado(p, estado) {
    const { error } = await supabase.from('pagos').update({ estado, revisado_por: uid }).eq('id', p.id)
    if (error) setMsg({ type: 'error', text: errorTexto(error) })
    load()
  }
  async function borrar(p) {
    if (!window.confirm(`¿Eliminar el pago de ${p.titular?.full_name} (${periodoTexto(p.periodo)})?`)) return
    await supabase.from('pagos').delete().eq('id', p.id); load()
  }

  async function elegirAct(id) {
    setM(x => ({ ...x, actividad_id: id, inscripcion_id: '', monto: String(acts.find(a => a.id === id)?.cuota ?? '') }))
    const { data } = await supabase.from('inscripciones')
      .select('id, titular_id, titular:profiles!titular_id(full_name), familiar:familiares(nombre)').eq('actividad_id', id).eq('estado', 'activa')
    setInscAct((data ?? []).sort((a, b) => participante(a).localeCompare(participante(b))))
  }
  async function registrar(e) {
    e.preventDefault(); setMsg(null)
    try {
      const i = inscAct.find(x => x.id === m.inscripcion_id)
      const comprobante_url = await subirArchivo(supabase, 'comprobantes', uid, file)
      const { error } = await supabase.from('pagos').insert({
        inscripcion_id: m.inscripcion_id, titular_id: i.titular_id, periodo: m.periodo, monto: Number(m.monto),
        metodo: m.metodo, estado: 'aprobado', revisado_por: uid, comprobante_url,
      })
      if (error) throw error
      setMsg({ type: 'ok', text: 'Pago registrado y aprobado.' }); setAbierto(false); setM(MANUAL()); setFile(null); load()
    } catch (err) { setMsg({ type: 'error', text: errorTexto(err) }) }
  }

  const visibles = pagos.filter(p => !fTxt || `${p.titular?.full_name} ${p.titular?.dni} ${p.inscripcion?.familiar?.nombre ?? ''}`.toLowerCase().includes(fTxt.toLowerCase()))
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Pagos</h1><p>Revisá los comprobantes que informan los vecinos.</p></div>
        {!abierto && <button className="btn btn-primary" onClick={() => setAbierto(true)}>Registrar pago en ventanilla</button>}</div>
      <Mensaje msg={msg} />

      {abierto && (
        <section className="card">
          <div className="row-between"><h2>Pago en ventanilla</h2><button className="btn btn-ghost btn-sm" onClick={() => setAbierto(false)}>Cerrar</button></div>
          <form onSubmit={registrar} className="form">
            <div className="grid-2">
              <label>Actividad<select value={m.actividad_id} onChange={e => elegirAct(e.target.value)} required>
                <option value="">Elegí…</option>{acts.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
              <label>Participante<select value={m.inscripcion_id} onChange={e => setM({ ...m, inscripcion_id: e.target.value })} required>
                <option value="">Elegí…</option>{inscAct.map(i => <option key={i.id} value={i.id}>{participante(i)}{i.familiar ? ` (${i.titular?.full_name})` : ''}</option>)}</select></label>
            </div>
            <div className="grid-3">
              <label>Monto<input type="number" min="1" step="0.01" value={m.monto} onChange={e => setM({ ...m, monto: e.target.value })} required /></label>
              <label>Mes<input type="month" value={m.periodo} onChange={e => setM({ ...m, periodo: e.target.value })} required /></label>
              <label>Medio<select value={m.metodo} onChange={e => setM({ ...m, metodo: e.target.value })}>{METODOS_PAGO.map(x => <option key={x}>{x}</option>)}</select></label>
            </div>
            <label>Comprobante (opcional)<input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files[0] ?? null)} /></label>
            <div><button className="btn btn-primary">Registrar pago</button></div>
          </form>
        </section>
      )}

      <section className="card">
        <div className="grid-3" style={{ marginBottom: '0.8rem' }}>
          <label>Estado<select value={fEstado} onChange={e => setFEstado(e.target.value)}>
            <option value="pendiente">Para revisar</option><option value="aprobado">Aprobados</option><option value="rechazado">Rechazados</option><option value="">Todos</option></select></label>
          <label>Actividad<select value={fAct} onChange={e => setFAct(e.target.value)}>
            <option value="">Todas</option>{acts.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
          <label>Buscar<input value={fTxt} onChange={e => setFTxt(e.target.value)} placeholder="Nombre o DNI" /></label>
        </div>
        {visibles.length === 0 ? <Vacio titulo={fEstado === 'pendiente' ? 'No hay pagos para revisar' : 'Sin resultados'} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Vecino/a</th><th>Actividad</th><th>Mes</th><th>Monto</th><th>Medio</th><th>Estado</th><th></th></tr></thead>
            <tbody>{visibles.map(p => (
              <tr key={p.id}>
                <td><b>{p.titular?.full_name}</b><div className="small muted">DNI {p.titular?.dni || '—'} · {fechaCorta(p.created_at)}</div></td>
                <td>{p.actividad?.nombre}{p.inscripcion?.familiar && <div className="small muted">{p.inscripcion.familiar.nombre}</div>}</td>
                <td className="nowrap">{periodoTexto(p.periodo)}</td>
                <td className="num nowrap">{pesos(p.monto)}</td>
                <td>{p.metodo}{p.comprobante_url && <div><button className="link-btn" onClick={() => abrirArchivo(supabase, 'comprobantes', p.comprobante_url)}>Ver comprobante</button></div>}</td>
                <td><Estado tipo="pago" valor={p.estado} /></td>
                <td className="row-actions">
                  {p.estado !== 'aprobado' && <button className="btn btn-sm btn-ok" onClick={() => setEstado(p, 'aprobado')}>Aprobar</button>}
                  {p.estado !== 'rechazado' && <button className="btn btn-sm btn-off" onClick={() => setEstado(p, 'rechazado')}>Rechazar</button>}
                  <button className="link-btn danger" onClick={() => borrar(p)}>Eliminar</button>
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  )
}

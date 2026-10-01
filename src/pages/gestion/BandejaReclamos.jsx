import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { AREAS, ESTADOS } from '../../lib/municipio'
import { fechaCorta, errorTexto, abrirArchivo, descargarCSV } from '../../lib/formato'
import Estado, { Vacio, Mensaje } from '../../components/Estado'

export default function BandejaReclamos() {
  const { uid, isAdmin } = useAuth()
  const [lista, setLista] = useState([])
  const [cats, setCats] = useState([])
  const [fEstado, setFEstado] = useState('abiertos')
  const [fCat, setFCat] = useState('')
  const [fTxt, setFTxt] = useState('')
  const [sel, setSel] = useState(null)
  const [eventos, setEventos] = useState([])
  const [nuevo, setNuevo] = useState({ estado: '', comentario: '' })
  const [msg, setMsg] = useState(null)

  async function load() {
    let q = supabase.from('reclamos')
      .select('*, categoria:reclamo_categorias(nombre), vecino:profiles!vecino_id(full_name, telefono, dni), asignado:profiles!asignado_a(full_name)')
      .order('created_at', { ascending: false }).limit(500)
    if (fEstado === 'abiertos') q = q.in('estado', ['recibido', 'en_curso'])
    else if (fEstado) q = q.eq('estado', fEstado)
    if (fCat) q = q.eq('categoria_id', fCat)
    const { data } = await q
    setLista(data ?? [])
  }
  useEffect(() => { supabase.from('reclamo_categorias').select('*').order('orden').then(({ data }) => setCats(data ?? [])) }, [])
  useEffect(() => { load() }, [fEstado, fCat])

  async function abrir(r) {
    setSel(r); setNuevo({ estado: '', comentario: '' }); setMsg(null)
    const { data } = await supabase.from('reclamo_eventos').select('*, autor:profiles!autor_id(full_name)').eq('reclamo_id', r.id).order('created_at')
    setEventos(data ?? [])
    setTimeout(() => document.getElementById('detalle')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function registrar(e) {
    e.preventDefault()
    if (!nuevo.estado && !nuevo.comentario.trim()) return
    const { error } = await supabase.from('reclamo_eventos').insert({
      reclamo_id: sel.id, autor_id: uid, estado: nuevo.estado || null, comentario: nuevo.comentario.trim() || null })
    if (error) return setMsg({ type: 'error', text: errorTexto(error) })
    setMsg({ type: 'ok', text: 'Actualización registrada. El vecino la ve en su historial.' })
    await load()
    const { data } = await supabase.from('reclamos').select('*, categoria:reclamo_categorias(nombre), vecino:profiles!vecino_id(full_name, telefono, dni), asignado:profiles!asignado_a(full_name)').eq('id', sel.id).single()
    abrir(data)
  }
  async function tomar() {
    await supabase.from('reclamos').update({ asignado_a: uid }).eq('id', sel.id)
    load(); setSel(s => ({ ...s, asignado_a: uid, asignado: { full_name: 'Vos' } }))
  }

  function exportar() {
    descargarCSV('reclamos.csv', [['N°', 'Fecha', 'Categoría', 'Área', 'Dirección', 'Descripción', 'Vecino/a', 'Teléfono', 'Estado'],
      ...vis.map(r => [r.numero, fechaCorta(r.created_at), r.categoria?.nombre, AREAS[r.area], r.direccion, r.descripcion, r.vecino?.full_name, r.vecino?.telefono, ESTADOS.reclamo[r.estado][0]])])
  }

  const vis = lista.filter(r => !fTxt || `${r.numero} ${r.direccion} ${r.descripcion} ${r.vecino?.full_name}`.toLowerCase().includes(fTxt.toLowerCase()))
  const dias = r => Math.floor((Date.now() - new Date(r.created_at)) / 86400000)
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Reclamos</h1><p>{isAdmin ? 'Todas las áreas.' : 'Los reclamos de tu área.'}</p></div>
        {vis.length > 0 && <button className="btn btn-ghost" onClick={exportar}>Descargar planilla</button>}</div>
      <section className="card">
        <div className="grid-3" style={{ marginBottom: '0.8rem' }}>
          <label>Estado<select value={fEstado} onChange={e => setFEstado(e.target.value)}>
            <option value="abiertos">Abiertos</option>
            {Object.entries(ESTADOS.reclamo).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            <option value="">Todos</option></select></label>
          <label>Categoría<select value={fCat} onChange={e => setFCat(e.target.value)}><option value="">Todas</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
          <label>Buscar<input value={fTxt} onChange={e => setFTxt(e.target.value)} placeholder="N°, dirección, vecino" /></label>
        </div>
        {vis.length === 0 ? <Vacio titulo="No hay reclamos con estos filtros" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>N°</th><th>Reclamo</th><th>Dirección</th><th>Antigüedad</th><th>Estado</th><th></th></tr></thead>
            <tbody>{vis.map(r => (
              <tr key={r.id} style={sel?.id === r.id ? { background: 'var(--celeste-soft)' } : undefined}>
                <td className="ticket-num">{r.numero}</td>
                <td><b>{r.categoria?.nombre}</b><div className="small muted">{r.descripcion.slice(0, 80)}{r.descripcion.length > 80 ? '…' : ''}</div></td>
                <td className="small">{r.direccion}</td>
                <td className="num small nowrap" style={{ color: dias(r) > 7 && ['recibido', 'en_curso'].includes(r.estado) ? 'var(--err)' : undefined }}>
                  {dias(r) === 0 ? 'Hoy' : `${dias(r)} días`}</td>
                <td><Estado tipo="reclamo" valor={r.estado} />{r.asignado && <div className="small muted">{r.asignado.full_name}</div>}</td>
                <td><button className="link-btn" onClick={() => abrir(r)}>Abrir</button></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>

      {sel && (
        <section className="card" id="detalle">
          <div className="row-between">
            <h2>Reclamo N° {sel.numero} · {sel.categoria?.nombre}</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setSel(null)}>Cerrar</button>
          </div>
          <div className="grid-2">
            <div>
              <p><b>Dirección:</b> {sel.direccion}
                {sel.lat && <> · <a href={`https://www.google.com/maps?q=${sel.lat},${sel.lng}`} target="_blank" rel="noreferrer">Ver en el mapa</a></>}</p>
              <p>{sel.descripcion}</p>
              {sel.foto_url && <button className="btn btn-ghost btn-sm" onClick={() => abrirArchivo(supabase, 'reclamos', sel.foto_url)}>Ver foto</button>}
              <p className="small muted" style={{ marginTop: '0.6rem' }}>
                {sel.vecino?.full_name} · DNI {sel.vecino?.dni || '—'} · {sel.vecino?.telefono || 'sin teléfono'}<br />
                {AREAS[sel.area]} · Ingresó el {fechaCorta(sel.created_at)}<br />
                {sel.asignado ? `Lo sigue: ${sel.asignado.full_name}` : <button className="link-btn" onClick={tomar}>Tomar este reclamo</button>}
              </p>
            </div>
            <div>
              <h3>Historial</h3>
              <ol className="timeline">{eventos.map(ev => (
                <li key={ev.id}><div className="small muted">{fechaCorta(ev.created_at)} · {ev.autor?.full_name ?? '—'}</div>
                  {ev.estado && <Estado tipo="reclamo" valor={ev.estado} />} {ev.comentario}</li>))}</ol>
            </div>
          </div>
          <form onSubmit={registrar} className="form" style={{ marginTop: '0.8rem', borderTop: '1px solid var(--line-soft)', paddingTop: '0.9rem' }}>
            <div className="grid-2">
              <label>Cambiar estado<select value={nuevo.estado} onChange={e => setNuevo({ ...nuevo, estado: e.target.value })}>
                <option value="">Sin cambio</option>
                {Object.entries(ESTADOS.reclamo).filter(([k]) => k !== sel.estado).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label>Mensaje para el vecino<input value={nuevo.comentario} onChange={e => setNuevo({ ...nuevo, comentario: e.target.value })}
                placeholder="Ej. La cuadrilla pasa el jueves." /></label>
            </div>
            <Mensaje msg={msg} />
            <div><button className="btn btn-primary">Registrar actualización</button></div>
          </form>
        </section>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { hoyISO, fechaCorta, errorTexto } from '../../lib/formato'
import { Vacio, Mensaje } from '../../components/Estado'

const VACIO = () => ({ titulo: '', cuerpo: '', tipo: 'info', enlace: '', desde: hoyISO(), hasta: '', publicado: true })
const TIPOS = { info: 'Información', alerta: 'Alerta (corte de servicio, clima)', evento: 'Evento' }

export default function Avisos() {
  const { uid } = useAuth()
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(null)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = () => supabase.from('avisos').select('*').order('desde', { ascending: false }).then(({ data }) => setLista(data ?? []))
  useEffect(() => { load() }, [])
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardar(e) {
    e.preventDefault()
    const datos = { ...form, enlace: form.enlace || null, hasta: form.hasta || null, cuerpo: form.cuerpo || null }
    const { error } = editId ? await supabase.from('avisos').update(datos).eq('id', editId)
      : await supabase.from('avisos').insert({ ...datos, autor_id: uid })
    if (error) return setMsg({ type: 'error', text: errorTexto(error) })
    setMsg({ type: 'ok', text: 'Aviso guardado. Aparece en el inicio de todos los vecinos.' }); setForm(null); load()
  }
  async function borrar(a) {
    if (!window.confirm(`¿Eliminar "${a.titulo}"?`)) return
    await supabase.from('avisos').delete().eq('id', a.id); load()
  }
  const vigente = a => a.publicado && a.desde <= hoyISO() && (!a.hasta || a.hasta >= hoyISO())

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Avisos</h1><p>Mensajes que aparecen en el inicio de la app.</p></div>
        {!form && <button className="btn btn-primary" onClick={() => { setForm(VACIO()); setEditId(null) }}>Nuevo aviso</button>}</div>
      <Mensaje msg={msg} />
      {form && (
        <section className="card">
          <form onSubmit={guardar} className="form">
            <label>Título<input value={form.titulo} onChange={e => up('titulo', e.target.value)} required maxLength={120} /></label>
            <label>Texto<textarea value={form.cuerpo ?? ''} onChange={e => up('cuerpo', e.target.value)} style={{ minHeight: 70 }} /></label>
            <div className="grid-2">
              <label>Tipo<select value={form.tipo} onChange={e => up('tipo', e.target.value)}>
                {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Enlace (opcional)<input type="url" value={form.enlace ?? ''} onChange={e => up('enlace', e.target.value)} placeholder="https://" /></label>
            </div>
            <div className="grid-2">
              <label>Mostrar desde<input type="date" value={form.desde} onChange={e => up('desde', e.target.value)} required /></label>
              <label>Hasta (opcional)<input type="date" value={form.hasta ?? ''} onChange={e => up('hasta', e.target.value)} /></label>
            </div>
            <label className="checkbox"><input type="checkbox" checked={form.publicado} onChange={e => up('publicado', e.target.checked)} /> Publicado</label>
            <div className="row-actions"><button className="btn btn-primary">Guardar aviso</button>
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button></div>
          </form>
        </section>
      )}
      <section className="card">
        {lista.length === 0 ? <Vacio titulo="No hay avisos" /> : (
          <ul className="list">{lista.map(a => (
            <li key={a.id} className="list-item row-between">
              <span><b>{a.titulo}</b> {vigente(a) ? <span className="pill pill-ok">Visible</span> : <span className="pill pill-mute">No visible</span>}
                <div className="small muted">{TIPOS[a.tipo]} · desde {fechaCorta(a.desde)}{a.hasta ? ` hasta ${fechaCorta(a.hasta)}` : ''}</div></span>
              <span className="row-actions">
                <button className="link-btn" onClick={() => { setEditId(a.id); setForm({ ...VACIO(), ...a }) }}>Editar</button>
                <button className="link-btn danger" onClick={() => borrar(a)}>Eliminar</button></span>
            </li>))}</ul>
        )}
      </section>
    </div>
  )
}

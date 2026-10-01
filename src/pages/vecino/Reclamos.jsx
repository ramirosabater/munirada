import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { fechaCorta, errorTexto, subirArchivo } from '../../lib/formato'
import Estado, { Vacio, Mensaje } from '../../components/Estado'
import Icon from '../../components/Icon'

const VACIO = { categoria_id: '', direccion: '', descripcion: '', lat: null, lng: null }

export default function Reclamos() {
  const { uid, profile } = useAuth()
  const [cats, setCats] = useState([])
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(VACIO)
  const [file, setFile] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [eventos, setEventos] = useState([])
  const [comentario, setComentario] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [geo, setGeo] = useState('')
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function load() {
    const { data } = await supabase.from('reclamos').select('*, categoria:reclamo_categorias(nombre)')
      .eq('vecino_id', uid).order('created_at', { ascending: false })
    setLista(data ?? [])
  }
  useEffect(() => {
    supabase.from('reclamo_categorias').select('*').order('orden').then(({ data }) => setCats(data ?? []))
    load()
  }, [])

  function ubicar() {
    if (!navigator.geolocation) return setGeo('Tu dispositivo no permite compartir la ubicación.')
    setGeo('Buscando ubicación…')
    navigator.geolocation.getCurrentPosition(
      p => { up('lat', p.coords.latitude); up('lng', p.coords.longitude); setGeo('Ubicación agregada.') },
      () => setGeo('No pudimos obtener la ubicación. Escribí la dirección con referencias.'),
      { enableHighAccuracy: true, timeout: 10000 })
  }

  async function enviar(e) {
    e.preventDefault()
    if (!form.categoria_id) return setMsg({ type: 'error', text: 'Elegí de qué se trata el reclamo.' })
    setBusy(true); setMsg(null)
    try {
      const foto_url = await subirArchivo(supabase, 'reclamos', uid, file)
      const { data, error } = await supabase.from('reclamos').insert({ ...form, vecino_id: uid, foto_url }).select('numero').single()
      if (error) throw error
      setMsg({ type: 'ok', text: `Recibimos tu reclamo N° ${data.numero}. Vas a ver acá cada novedad.` })
      setForm(VACIO); setFile(null); setGeo(''); setAbierto(false); load()
    } catch (err) { setMsg({ type: 'error', text: errorTexto(err) }) }
    setBusy(false)
  }

  async function abrir(r) {
    if (detalle?.id === r.id) return setDetalle(null)
    setDetalle(r); setComentario('')
    const { data } = await supabase.from('reclamo_eventos').select('*').eq('reclamo_id', r.id).order('created_at')
    setEventos(data ?? [])
  }

  async function comentar(e) {
    e.preventDefault()
    if (!comentario.trim()) return
    const { error } = await supabase.from('reclamo_eventos').insert({ reclamo_id: detalle.id, autor_id: uid, comentario: comentario.trim() })
    if (error) return setMsg({ type: 'error', text: errorTexto(error) })
    setComentario('')
    const { data } = await supabase.from('reclamo_eventos').select('*').eq('reclamo_id', detalle.id).order('created_at')
    setEventos(data ?? [])
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Reclamos</h1><p>Avisanos de problemas en la vía pública y seguí cómo avanzan.</p></div>
        {!abierto && <button className="btn btn-primary" onClick={() => { setAbierto(true); setMsg(null); setForm(f => ({ ...f, direccion: f.direccion || '' })) }}>Nuevo reclamo</button>}
      </div>
      {!abierto && <Mensaje msg={msg} />}
      <div className="alert alert-warn">Ante una emergencia llamá al 911, Bomberos (445-1004) o Defensa Civil (445-1303).</div>

      {abierto && (
        <section className="card">
          <div className="row-between"><h2>Nuevo reclamo</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setAbierto(false)}>Cerrar</button></div>
          <form onSubmit={enviar} className="form">
            <div>
              <span className="field-label">¿De qué se trata?</span>
              <div className="cat-grid">
                {cats.map(c => (
                  <button type="button" key={c.id} className={'cat' + (form.categoria_id === c.id ? ' on' : '')}
                    aria-pressed={form.categoria_id === c.id} onClick={() => up('categoria_id', c.id)}>{c.nombre}</button>
                ))}
              </div>
            </div>
            <label>Dirección o lugar exacto
              <input value={form.direccion} onChange={e => up('direccion', e.target.value)} required
                placeholder="Ej. Av. Moyano y Capitán Rada, frente a la plaza" />
            </label>
            <div className="row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={ubicar}><Icon name="ubicacion" size={18} /> Usar mi ubicación</button>
              {geo && <span className="small muted">{geo}</span>}
              {!form.direccion && profile?.direccion && (
                <button type="button" className="link-btn" onClick={() => up('direccion', profile.direccion)}>Usar mi domicilio</button>)}
            </div>
            <label>Contanos qué pasa
              <textarea value={form.descripcion} onChange={e => up('descripcion', e.target.value)} required minLength={10}
                placeholder="Ej. La luminaria del poste frente al 230 está apagada hace una semana." />
            </label>
            <label>Foto (opcional)
              <input type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files[0] ?? null)} />
            </label>
            <Mensaje msg={msg} />
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar reclamo'}</button>
          </form>
        </section>
      )}

      <section className="card">
        <h2>Mis reclamos</h2>
        {lista.length === 0 ? <Vacio titulo="No hiciste reclamos">Cuando hagas uno, vas a poder seguirlo desde acá.</Vacio> : (
          <ul className="list">{lista.map(r => (
            <li key={r.id} className="list-item">
              <button className="row-between" onClick={() => abrir(r)} aria-expanded={detalle?.id === r.id}
                style={{ width: '100%', background: 'none', border: 0, padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span><span className="ticket-num">N° {r.numero}</span> · <b>{r.categoria?.nombre}</b>
                  <span className="small muted"> · {r.direccion} · {fechaCorta(r.created_at)}</span></span>
                <Estado tipo="reclamo" valor={r.estado} />
              </button>
              {detalle?.id === r.id && (
                <div style={{ marginTop: '0.7rem' }}>
                  <p className="small">{r.descripcion}</p>
                  <ol className="timeline">{eventos.map(ev => (
                    <li key={ev.id}>
                      <div className="small muted">{fechaCorta(ev.created_at)}{ev.autor_id === uid ? ' · Vos' : ' · Municipalidad'}</div>
                      {ev.estado && <Estado tipo="reclamo" valor={ev.estado} />} {ev.comentario}
                    </li>))}
                  </ol>
                  {!['resuelto', 'rechazado'].includes(r.estado) && (
                    <form onSubmit={comentar} className="inline-add row" style={{ marginTop: '0.4rem' }}>
                      <input value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Agregar un dato o comentario" style={{ flex: 1, minWidth: 200 }} />
                      <button className="btn btn-sm btn-primary">Enviar</button>
                    </form>
                  )}
                </div>
              )}
            </li>))}
          </ul>
        )}
      </section>
    </div>
  )
}

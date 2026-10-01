import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { calcularEdad, errorTexto } from '../../lib/formato'
import { Vacio, Mensaje } from '../../components/Estado'

const PARENTESCOS = ['Hijo/a', 'Nieto/a', 'Pareja', 'Madre/Padre', 'Abuelo/a', 'Otro']
const FAM_VACIO = { nombre: '', dni: '', fecha_nacimiento: '', parentesco: 'Hijo/a' }

export default function MiCuenta() {
  const { profile, uid, reloadProfile, signOut } = useAuth()
  const [f, setF] = useState(null)
  const [fam, setFam] = useState([])
  const [nf, setNf] = useState(FAM_VACIO)
  const [abiertoFam, setAbiertoFam] = useState(false)
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState(null)
  const [msgFam, setMsgFam] = useState(null)

  useEffect(() => {
    if (profile) setF({ full_name: profile.full_name ?? '', dni: profile.dni ?? '', telefono: profile.telefono ?? '',
      direccion: profile.direccion ?? '', barrio: profile.barrio ?? '', fecha_nacimiento: profile.fecha_nacimiento ?? '' })
  }, [profile])
  async function loadFam() {
    const { data } = await supabase.from('familiares').select('*').eq('titular_id', uid).order('nombre')
    setFam(data ?? [])
  }
  useEffect(() => { loadFam() }, [])

  async function guardar(e) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ ...f, fecha_nacimiento: f.fecha_nacimiento || null }).eq('id', uid)
    setMsg(error ? { type: 'error', text: errorTexto(error) } : { type: 'ok', text: 'Datos guardados.' })
    reloadProfile()
  }
  async function cambiarPass(e) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: pass })
    setMsg(error ? { type: 'error', text: errorTexto(error) } : { type: 'ok', text: 'Contraseña actualizada.' })
    setPass('')
  }
  async function agregarFam(e) {
    e.preventDefault()
    const { error } = await supabase.from('familiares').insert({ ...nf, titular_id: uid, fecha_nacimiento: nf.fecha_nacimiento || null })
    if (error) return setMsgFam({ type: 'error', text: errorTexto(error) })
    setNf(FAM_VACIO); setAbiertoFam(false); setMsgFam({ type: 'ok', text: 'Familiar agregado. Ya podés inscribirlo/a en actividades.' }); loadFam()
  }
  async function quitarFam(x) {
    if (!window.confirm(`¿Quitar a ${x.nombre}? También se borran sus inscripciones.`)) return
    const { error } = await supabase.from('familiares').delete().eq('id', x.id)
    setMsgFam(error ? { type: 'error', text: errorTexto(error) } : null); loadFam()
  }

  if (!f) return null
  const up = (k, v) => setF(x => ({ ...x, [k]: v }))
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Mi cuenta</h1><p>{profile.full_name}</p></div>
        <button className="btn btn-ghost" onClick={signOut}>Cerrar sesión</button></div>

      <div className="row">
        <Link className="chip" style={{ textDecoration: 'none' }} to="/mis-actividades">Mis inscripciones</Link>
        <Link className="chip" style={{ textDecoration: 'none' }} to="/pagos">Mis pagos</Link>
        <Link className="chip" style={{ textDecoration: 'none' }} to="/tramites">Trámites y teléfonos</Link>
      </div>

      <section className="card">
        <div className="row-between"><h2>Grupo familiar</h2>
          {!abiertoFam && <button className="btn btn-sm btn-primary" onClick={() => setAbiertoFam(true)}>Agregar familiar</button>}</div>
        <p className="muted small">Sumá a hijos/as u otras personas a cargo para inscribirlas a actividades a tu nombre.</p>
        <Mensaje msg={msgFam} />
        {abiertoFam && (
          <form onSubmit={agregarFam} className="form" style={{ margin: '0.8rem 0' }}>
            <label>Nombre y apellido<input value={nf.nombre} onChange={e => setNf({ ...nf, nombre: e.target.value })} required /></label>
            <div className="grid-3">
              <label>DNI<input inputMode="numeric" value={nf.dni} onChange={e => setNf({ ...nf, dni: e.target.value })} /></label>
              <label>Fecha de nacimiento<input type="date" value={nf.fecha_nacimiento} onChange={e => setNf({ ...nf, fecha_nacimiento: e.target.value })} required /></label>
              <label>Parentesco<select value={nf.parentesco} onChange={e => setNf({ ...nf, parentesco: e.target.value })}>
                {PARENTESCOS.map(p => <option key={p}>{p}</option>)}</select></label>
            </div>
            <div className="row-actions"><button className="btn btn-primary">Agregar</button>
              <button type="button" className="btn btn-ghost" onClick={() => setAbiertoFam(false)}>Cancelar</button></div>
          </form>
        )}
        {fam.length === 0 && !abiertoFam ? <Vacio titulo="Sin familiares cargados" /> : (
          <ul className="list">{fam.map(x => (
            <li key={x.id} className="list-item row-between">
              <span><b>{x.nombre}</b> <span className="small muted">· {x.parentesco}{x.fecha_nacimiento ? ` · ${calcularEdad(x.fecha_nacimiento)} años` : ''}</span></span>
              <button className="link-btn danger" onClick={() => quitarFam(x)}>Quitar</button>
            </li>))}</ul>
        )}
      </section>

      <section className="card">
        <h2>Mis datos</h2>
        <form onSubmit={guardar} className="form">
          <label>Nombre y apellido<input value={f.full_name} onChange={e => up('full_name', e.target.value)} required /></label>
          <div className="grid-3">
            <label>DNI<input value={f.dni} onChange={e => up('dni', e.target.value)} /></label>
            <label>Fecha de nacimiento<input type="date" value={f.fecha_nacimiento} onChange={e => up('fecha_nacimiento', e.target.value)} /></label>
            <label>Teléfono<input type="tel" value={f.telefono} onChange={e => up('telefono', e.target.value)} /></label>
          </div>
          <div className="grid-2">
            <label>Dirección<input value={f.direccion} onChange={e => up('direccion', e.target.value)} /></label>
            <label>Barrio<input value={f.barrio} onChange={e => up('barrio', e.target.value)} /></label>
          </div>
          <Mensaje msg={msg} />
          <div><button className="btn btn-primary">Guardar datos</button></div>
        </form>
      </section>

      <section className="card">
        <h2>Contraseña</h2>
        <form onSubmit={cambiarPass} className="row">
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} minLength={8} required
            placeholder="Nueva contraseña" autoComplete="new-password" style={{ flex: 1, minWidth: 200 }} aria-label="Nueva contraseña" />
          <button className="btn btn-ghost">Cambiar</button>
        </form>
      </section>
    </div>
  )
}

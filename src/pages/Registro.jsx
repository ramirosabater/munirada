import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { errorTexto } from '../lib/formato'
import { Mensaje } from '../components/Estado'
import AuthShell from './AuthShell'

const VACIO = { full_name: '', dni: '', fecha_nacimiento: '', telefono: '', direccion: '', barrio: '', email: '', password: '' }

export default function Registro() {
  const [f, setF] = useState(VACIO)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [listo, setListo] = useState(false)
  const up = (k, v) => setF(x => ({ ...x, [k]: v }))

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { email, password, ...datos } = f
    datos.dni = datos.dni.replace(/\D/g, '')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: datos, emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) return setMsg({ type: 'error', text: errorTexto(error) })
    if (!data.session) setListo(true) // hay que confirmar el correo
  }

  if (listo) return (
    <AuthShell titulo="Revisá tu correo">
      <p>Te enviamos un enlace a <b>{f.email}</b> para confirmar tu cuenta. Después podés ingresar.</p>
      <Link className="btn btn-primary btn-block" to="/ingresar">Ir a ingresar</Link>
    </AuthShell>
  )

  return (
    <AuthShell titulo="Creá tu cuenta" bajada="Con tus datos podés inscribirte, hacer reclamos y sacar turnos.">
      <form onSubmit={submit} className="form">
        <label>Nombre y apellido
          <input value={f.full_name} onChange={e => up('full_name', e.target.value)} required autoComplete="name" />
        </label>
        <div className="grid-2">
          <label>DNI
            <input inputMode="numeric" value={f.dni} onChange={e => up('dni', e.target.value)} required minLength={7} />
          </label>
          <label>Fecha de nacimiento
            <input type="date" value={f.fecha_nacimiento} onChange={e => up('fecha_nacimiento', e.target.value)} required />
          </label>
        </div>
        <label>Teléfono celular
          <input type="tel" value={f.telefono} onChange={e => up('telefono', e.target.value)} required placeholder="297 4XX XXXX" autoComplete="tel" />
        </label>
        <div className="grid-2">
          <label>Dirección
            <input value={f.direccion} onChange={e => up('direccion', e.target.value)} required autoComplete="street-address" />
          </label>
          <label>Barrio
            <input value={f.barrio} onChange={e => up('barrio', e.target.value)} placeholder="Opcional" />
          </label>
        </div>
        <label>Correo electrónico
          <input type="email" value={f.email} onChange={e => up('email', e.target.value)} required autoComplete="email" />
        </label>
        <label>Contraseña
          <input type="password" value={f.password} onChange={e => up('password', e.target.value)} required minLength={8} autoComplete="new-password" />
          <span className="hint" style={{ fontWeight: 400, margin: 0 }}>Mínimo 8 caracteres.</span>
        </label>
        <Mensaje msg={msg} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      </form>
      <p className="center hint">¿Ya tenés cuenta? <Link to="/ingresar">Ingresá</Link></p>
    </AuthShell>
  )
}

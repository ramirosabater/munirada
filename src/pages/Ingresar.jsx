import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { errorTexto } from '../lib/formato'
import { Mensaje } from '../components/Estado'
import AuthShell from './AuthShell'

export default function Ingresar() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) setMsg({ type: 'error', text: error.message.includes('Email not confirmed')
      ? 'Todavía no confirmaste tu correo. Revisá tu bandeja de entrada.' : errorTexto(error) })
    setBusy(false)
  }

  async function recuperar() {
    if (!email) return setMsg({ type: 'warn', text: 'Escribí tu correo arriba y volvé a tocar "Olvidé mi contraseña".' })
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin + '/cuenta' })
    setMsg(error ? { type: 'error', text: errorTexto(error) } : { type: 'ok', text: 'Te enviamos un correo para cambiar la contraseña.' })
  }

  return (
    <AuthShell titulo="Servicios al vecino" bajada="Actividades, reclamos, turnos y pagos en un solo lugar.">
      <form onSubmit={submit} className="form">
        <label>Correo electrónico
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>Contraseña
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        <Mensaje msg={msg} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        <button type="button" className="link-btn" onClick={recuperar}>Olvidé mi contraseña</button>
      </form>
      <hr style={{ border: 0, borderTop: '1px solid var(--line-soft)', margin: '1.2rem 0' }} />
      <p className="center" style={{ margin: 0 }}>¿Primera vez? <Link to="/registro"><b>Creá tu cuenta</b></Link></p>
    </AuthShell>
  )
}

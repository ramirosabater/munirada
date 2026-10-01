import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { DATOS_TRANSFERENCIA, METODOS_PAGO } from '../../lib/municipio'
import { mesActual, pesos, periodoTexto, participante, errorTexto, subirArchivo, abrirArchivo, fechaCorta } from '../../lib/formato'
import AvisoCuota from '../../components/AvisoCuota'
import Estado, { Vacio, Mensaje } from '../../components/Estado'

export default function MisPagos() {
  const { uid } = useAuth()
  const [pagos, setPagos] = useState([])
  const [insc, setInsc] = useState([])
  const [form, setForm] = useState({ inscripcion_id: '', monto: '', periodo: mesActual(), metodo: 'transferencia' })
  const [file, setFile] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function load() {
    const { data: p } = await supabase.from('pagos')
      .select('*, actividad:actividades(nombre), inscripcion:inscripciones(familiar:familiares(nombre))')
      .eq('titular_id', uid).order('created_at', { ascending: false })
    setPagos(p ?? [])
    const { data: i } = await supabase.from('inscripciones')
      .select('id, titular:profiles!titular_id(full_name), familiar:familiares(nombre), actividad:actividades(nombre, cuota, modalidad_pago)')
      .eq('titular_id', uid).eq('estado', 'activa')
    setInsc((i ?? []).filter(x => Number(x.actividad?.cuota) > 0))
  }
  useEffect(() => { load() }, [])

  function elegir(id) {
    const i = insc.find(x => x.id === id)
    setForm(f => ({ ...f, inscripcion_id: id, monto: i ? String(i.actividad.cuota) : f.monto }))
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      if (form.metodo === 'transferencia' && !file) throw new Error('Adjuntá el comprobante de la transferencia.')
      const comprobante_url = await subirArchivo(supabase, 'comprobantes', uid, file)
      const { error } = await supabase.from('pagos').insert({
        titular_id: uid, inscripcion_id: form.inscripcion_id, periodo: form.periodo,
        monto: Number(form.monto), metodo: form.metodo, comprobante_url,
      })
      if (error) throw error
      setMsg({ type: 'ok', text: 'Pago informado. El área lo revisa y queda aprobado en unos días hábiles.' })
      setAbierto(false); setFile(null); setForm({ inscripcion_id: '', monto: '', periodo: mesActual(), metodo: 'transferencia' })
      load()
    } catch (err) { setMsg({ type: 'error', text: errorTexto(err) }) }
    setBusy(false)
  }

  const hayDatos = DATOS_TRANSFERENCIA.alias || DATOS_TRANSFERENCIA.cbu
  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Pagos de cuotas</h1><p>Informá el pago de tus actividades adjuntando el comprobante.</p></div>
        {!abierto && insc.length > 0 && <button className="btn btn-primary" onClick={() => { setAbierto(true); setMsg(null) }}>Informar un pago</button>}
      </div>
      <AvisoCuota />
      {!abierto && <Mensaje msg={msg} />}

      {abierto && (
        <section className="card">
          <div className="row-between"><h2>Informar un pago</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setAbierto(false)}>Cerrar</button></div>
          {hayDatos && (
            <div className="alert alert-info" style={{ marginBottom: '0.9rem' }}>
              Transferí a <b>{DATOS_TRANSFERENCIA.titular}</b>
              {DATOS_TRANSFERENCIA.cuit && <> (CUIT {DATOS_TRANSFERENCIA.cuit})</>}
              {DATOS_TRANSFERENCIA.alias && <><br />Alias: <b>{DATOS_TRANSFERENCIA.alias}</b></>}
              {DATOS_TRANSFERENCIA.cbu && <><br />CBU: <b className="num">{DATOS_TRANSFERENCIA.cbu}</b></>}
            </div>
          )}
          <form onSubmit={submit} className="form">
            <label>Actividad que pagás
              <select value={form.inscripcion_id} onChange={e => elegir(e.target.value)} required>
                <option value="">Elegí una…</option>
                {insc.map(i => <option key={i.id} value={i.id}>{i.actividad.nombre} · {participante(i)}</option>)}
              </select>
            </label>
            <div className="grid-2">
              <label>Monto
                <input type="number" min="1" step="0.01" value={form.monto} onChange={e => up('monto', e.target.value)} required />
              </label>
              <label>Mes que pagás
                <input type="month" value={form.periodo} onChange={e => up('periodo', e.target.value)} required />
              </label>
            </div>
            <label>Medio de pago
              <select value={form.metodo} onChange={e => up('metodo', e.target.value)}>
                {METODOS_PAGO.map(m => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
              </select>
            </label>
            <label>Comprobante {form.metodo !== 'transferencia' && '(opcional)'}
              <input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files[0] ?? null)} />
            </label>
            <Mensaje msg={msg} />
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Enviando…' : 'Informar pago'}</button>
          </form>
        </section>
      )}

      <section className="card">
        <h2>Historial</h2>
        {pagos.length === 0 ? <Vacio titulo="Sin pagos informados">
          {insc.length === 0 ? 'Cuando te inscribas a una actividad con cuota, vas a poder pagarla acá.' : 'Informá tu primer pago con el botón de arriba.'}</Vacio> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Mes</th><th>Actividad</th><th>Monto</th><th>Informado</th><th>Estado</th><th></th></tr></thead>
            <tbody>{pagos.map(p => (
              <tr key={p.id}>
                <td className="nowrap">{periodoTexto(p.periodo)}</td>
                <td>{p.actividad?.nombre}{p.inscripcion?.familiar && <div className="small muted">{p.inscripcion.familiar.nombre}</div>}</td>
                <td className="num nowrap">{pesos(p.monto)}</td>
                <td className="num">{fechaCorta(p.created_at)}</td>
                <td><Estado tipo="pago" valor={p.estado} /></td>
                <td>{p.comprobante_url && <button className="link-btn" onClick={() => abrirArchivo(supabase, 'comprobantes', p.comprobante_url)}>Comprobante</button>}</td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </section>
    </div>
  )
}

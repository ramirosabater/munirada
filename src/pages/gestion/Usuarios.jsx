import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { ROLES, AREAS } from '../../lib/municipio'
import { calcularEdad, errorTexto, descargarCSV } from '../../lib/formato'
import { Vacio, Mensaje } from '../../components/Estado'

export default function Usuarios() {
  const [lista, setLista] = useState([])
  const [fTxt, setFTxt] = useState('')
  const [fRol, setFRol] = useState('')
  const [edit, setEdit] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = () => supabase.from('profiles').select('*').order('full_name').then(({ data }) => setLista(data ?? []))
  useEffect(() => { load() }, [])

  async function guardar(e) {
    e.preventDefault()
    const { id, role, area, activo } = edit
    const { error } = await supabase.from('profiles').update({ role, area: role === 'agente' ? area || null : null, activo }).eq('id', id)
    if (error) return setMsg({ type: 'error', text: errorTexto(error) })
    setMsg({ type: 'ok', text: 'Permisos actualizados. El cambio se aplica la próxima vez que la persona entre.' }); setEdit(null); load()
  }

  const vis = lista.filter(u => (!fRol || u.role === fRol) &&
    (!fTxt || `${u.full_name} ${u.dni} ${u.telefono} ${u.direccion}`.toLowerCase().includes(fTxt.toLowerCase())))
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Usuarios</h1>
        <p>Los vecinos se registran solos. Acá asignás quién es profesor/a, agente de un área o administración.</p></div>
        <button className="btn btn-ghost" onClick={() => descargarCSV('vecinos.csv', [['Nombre', 'DNI', 'Teléfono', 'Dirección', 'Barrio', 'Rol', 'Activo'],
          ...vis.map(u => [u.full_name, u.dni, u.telefono, u.direccion, u.barrio, ROLES[u.role], u.activo ? 'Sí' : 'No'])])}>Descargar planilla</button></div>
      <Mensaje msg={msg} />
      {edit && (
        <section className="card">
          <h2>{edit.full_name}</h2>
          <form onSubmit={guardar} className="form">
            <div className="grid-2">
              <label>Rol<select value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              {edit.role === 'agente' && <label>Área<select value={edit.area ?? ''} onChange={e => setEdit({ ...edit, area: e.target.value })} required>
                <option value="">Elegí…</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
            </div>
            <label className="checkbox"><input type="checkbox" checked={edit.activo} onChange={e => setEdit({ ...edit, activo: e.target.checked })} /> Cuenta habilitada</label>
            <div className="row-actions"><button className="btn btn-primary">Guardar permisos</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
          </form>
        </section>
      )}
      <section className="card">
        <div className="grid-2" style={{ marginBottom: '0.8rem' }}>
          <label>Buscar<input value={fTxt} onChange={e => setFTxt(e.target.value)} placeholder="Nombre, DNI, teléfono, dirección" /></label>
          <label>Rol<select value={fRol} onChange={e => setFRol(e.target.value)}><option value="">Todos</option>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <p className="small muted">{vis.length} personas</p>
        {vis.length === 0 ? <Vacio titulo="Sin resultados" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Nombre</th><th>DNI</th><th>Contacto</th><th>Rol</th><th></th></tr></thead>
            <tbody>{vis.slice(0, 300).map(u => (
              <tr key={u.id} style={!u.activo ? { opacity: 0.55 } : undefined}>
                <td><b>{u.full_name || '(sin nombre)'}</b>{u.fecha_nacimiento && <div className="small muted">{calcularEdad(u.fecha_nacimiento)} años</div>}</td>
                <td className="num">{u.dni || '—'}</td>
                <td className="small">{u.telefono || '—'}<div className="muted">{[u.direccion, u.barrio].filter(Boolean).join(', ')}</div></td>
                <td>{ROLES[u.role]}{u.role === 'agente' && u.area && <div className="small muted">{AREAS[u.area]}</div>}
                  {!u.activo && <div><span className="pill pill-off">Inhabilitada</span></div>}</td>
                <td><button className="link-btn" onClick={() => setEdit({ ...u })}>Permisos</button></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  )
}

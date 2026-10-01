import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { mesActual, pesos, periodoTexto, participante, descargarCSV } from '../../lib/formato'
import { Vacio } from '../../components/Estado'

const DIA_GRACIA = 10

export default function Cobranzas() {
  const { profile } = useAuth()
  const [periodo, setPeriodo] = useState(mesActual())
  const [filas, setFilas] = useState([])
  const [fEstado, setFEstado] = useState('')
  const [fAct, setFAct] = useState('')

  useEffect(() => {
    async function calcular() {
      let qa = supabase.from('actividades').select('id, nombre, cuota, modalidad_pago').gt('cuota', 0).eq('modalidad_pago', 'mensual')
      if (profile.role === 'agente') qa = qa.eq('area', profile.area)
      const { data: acts } = await qa
      const ids = (acts ?? []).map(a => a.id)
      if (!ids.length) return setFilas([])
      const [{ data: insc }, { data: pagos }] = await Promise.all([
        supabase.from('inscripciones').select('id, actividad_id, created_at, titular:profiles!titular_id(full_name, dni, telefono), familiar:familiares(nombre)')
          .in('actividad_id', ids).eq('estado', 'activa'),
        supabase.from('pagos').select('inscripcion_id, monto, estado').in('actividad_id', ids).eq('periodo', periodo),
      ])
      const vencido = periodo < mesActual() || (periodo === mesActual() && new Date().getDate() > DIA_GRACIA)
      setFilas((insc ?? []).filter(i => (i.created_at || '').slice(0, 7) <= periodo).map(i => {
        const a = acts.find(x => x.id === i.actividad_id)
        const ps = (pagos ?? []).filter(p => p.inscripcion_id === i.id)
        const pagado = ps.filter(p => p.estado === 'aprobado').reduce((s, p) => s + Number(p.monto), 0)
        const revision = ps.some(p => p.estado === 'pendiente')
        const estado = pagado >= Number(a.cuota) ? 'al_dia' : revision ? 'revision' : vencido ? 'debe' : 'plazo'
        return { ...i, actividad: a, pagado, debe: Math.max(Number(a.cuota) - pagado, 0), estado }
      }).sort((x, y) => x.actividad.nombre.localeCompare(y.actividad.nombre) || participante(x).localeCompare(participante(y))))
    }
    calcular()
  }, [periodo])

  const ETQ = { al_dia: ['Al día', 'ok'], revision: ['En revisión', 'warn'], debe: ['Debe', 'off'], plazo: ['En plazo', 'mute'] }
  const actsLista = useMemo(() => [...new Map(filas.map(f => [f.actividad.id, f.actividad])).values()], [filas])
  const vis = filas.filter(f => (!fEstado || f.estado === fEstado) && (!fAct || f.actividad.id === fAct))
  const total = filas.reduce((s, f) => s + Number(f.actividad.cuota), 0)
  const cobrado = filas.reduce((s, f) => s + Math.min(f.pagado, Number(f.actividad.cuota)), 0)

  function exportar() {
    descargarCSV(`cobranzas-${periodo}.csv`, [['Actividad', 'Participante', 'Titular', 'DNI', 'Teléfono', 'Cuota', 'Pagado', 'Saldo', 'Estado'],
      ...vis.map(f => [f.actividad.nombre, participante(f), f.titular?.full_name, f.titular?.dni, f.titular?.telefono, f.actividad.cuota, f.pagado, f.debe, ETQ[f.estado][0]])])
  }

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Cobranzas</h1><p>Estado de las cuotas mensuales de {periodoTexto(periodo)}.</p></div>
        <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ width: 'auto' }} aria-label="Mes" /></div>
      <div className="stats">
        <div className="stat"><div className="stat-num">{pesos(cobrado)}</div><div className="stat-lbl">Cobrado de {pesos(total)}</div></div>
        <div className="stat"><div className="stat-num">{filas.filter(f => f.estado === 'al_dia').length}</div><div className="stat-lbl">Al día</div></div>
        <div className="stat"><div className="stat-num">{filas.filter(f => f.estado === 'revision').length}</div><div className="stat-lbl">En revisión</div></div>
        <div className="stat"><div className="stat-num">{filas.filter(f => f.estado === 'debe').length}</div><div className="stat-lbl">Con deuda</div></div>
      </div>
      <section className="card">
        <div className="grid-3" style={{ marginBottom: '0.8rem', alignItems: 'end' }}>
          <label>Estado<select value={fEstado} onChange={e => setFEstado(e.target.value)}><option value="">Todos</option>
            {Object.entries(ETQ).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Actividad<select value={fAct} onChange={e => setFAct(e.target.value)}><option value="">Todas</option>
            {actsLista.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
          <div>{vis.length > 0 && <button className="btn btn-ghost" onClick={exportar}>Descargar planilla</button>}</div>
        </div>
        {vis.length === 0 ? <Vacio titulo="No hay cuotas para mostrar" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Participante</th><th>Actividad</th><th>Cuota</th><th>Saldo</th><th>Estado</th></tr></thead>
            <tbody>{vis.map(f => (
              <tr key={f.id}>
                <td><b>{participante(f)}</b><div className="small muted">{f.familiar ? `a cargo de ${f.titular?.full_name} · ` : ''}{f.titular?.telefono}</div></td>
                <td>{f.actividad.nombre}</td>
                <td className="num nowrap">{pesos(f.actividad.cuota)}</td>
                <td className="num nowrap">{f.debe ? pesos(f.debe) : '—'}</td>
                <td><span className={'pill pill-' + ETQ[f.estado][1]}>{ETQ[f.estado][0]}</span></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { AREAS, areaColor } from '../../lib/municipio'
import { horarioTexto, precioTexto, edadTexto, calcularEdad, hoyISO, errorTexto } from '../../lib/formato'
import Estado, { Vacio, Mensaje } from '../../components/Estado'

const FILTROS = [
  { k: '', l: 'Todas' },
  { k: 'deportes', l: 'Deportes' },
  { k: 'cultura', l: 'Cultura y arte' },
  { k: 'mayores', l: 'Adultos mayores' },
  { k: 'infancias', l: 'Infancias' },
  { k: 'eventos', l: 'Eventos' },
  { k: 'gratis', l: 'Gratuitas' },
]

function pasaFiltro(a, f) {
  const pub = (a.publico || '').toLowerCase()
  switch (f) {
    case 'deportes': case 'cultura': return a.area === f
    case 'mayores': return pub.includes('mayores')
    case 'infancias': return pub.includes('infanc') || pub.includes('menores') || (a.edad_max && a.edad_max < 18)
    case 'eventos': return !!a.fecha_evento
    case 'gratis': return !Number(a.cuota)
    default: return true
  }
}

export default function Actividades() {
  const { uid, profile } = useAuth()
  const [acts, setActs] = useState([])
  const [ocupados, setOcupados] = useState({})
  const [mias, setMias] = useState([])
  const [familia, setFamilia] = useState([])
  const [filtro, setFiltro] = useState('')
  const [buscar, setBuscar] = useState('')
  const [abierta, setAbierta] = useState(null)   // actividad que se está inscribiendo
  const [quien, setQuien] = useState('')         // '' = yo, o id de familiar
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const h = hoyISO()
    const [{ data: a }, { data: c }, { data: m }, { data: f }] = await Promise.all([
      supabase.from('actividades').select('*, sede:sedes(nombre, direccion)').eq('activa', true)
        .or(`fecha_evento.is.null,fecha_evento.gte.${h}`).order('area').order('nombre'),
      supabase.rpc('cupos_ocupados'),
      supabase.from('inscripciones').select('id, actividad_id, familiar_id, estado').eq('titular_id', uid)
        .not('estado', 'in', '(baja,rechazada)'),
      supabase.from('familiares').select('*').eq('titular_id', uid).order('nombre'),
    ])
    setActs(a ?? [])
    setOcupados(Object.fromEntries((c ?? []).map(x => [x.actividad_id, Number(x.ocupados)])))
    setMias(m ?? [])
    setFamilia(f ?? [])
  }
  useEffect(() => { load() }, [])

  const visibles = useMemo(() => acts.filter(a => pasaFiltro(a, filtro) &&
    (!buscar || (a.nombre + ' ' + (a.docente || '') + ' ' + (a.sede?.nombre || '')).toLowerCase().includes(buscar.toLowerCase()))), [acts, filtro, buscar])

  const personas = [{ id: '', nombre: 'Yo', fecha_nacimiento: profile?.fecha_nacimiento }, ...familia]
  const inscripcionDe = (actId, famId) => mias.find(m => m.actividad_id === actId && (m.familiar_id ?? '') === famId)

  function avisoEdad(a, persona) {
    const edad = calcularEdad(persona?.fecha_nacimiento)
    if (edad == null) return null
    if (a.edad_min && edad < a.edad_min) return `Esta actividad es desde ${a.edad_min} años (${persona.nombre === 'Yo' ? 'tenés' : 'tiene'} ${edad}).`
    if (a.edad_max && edad > a.edad_max) return `Esta actividad es hasta ${a.edad_max} años (${persona.nombre === 'Yo' ? 'tenés' : 'tiene'} ${edad}).`
    return null
  }

  async function inscribir(a) {
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.from('inscripciones')
      .insert({ actividad_id: a.id, titular_id: uid, familiar_id: quien || null }).select('estado').single()
    setBusy(false)
    if (error) return setMsg({ type: 'error', text: errorTexto(error) })
    const textos = {
      activa: `¡Listo! Quedó la inscripción a ${a.nombre}.` + (Number(a.cuota) ? ' Podés pagar la cuota desde Pagos.' : ''),
      pendiente: `Enviamos tu solicitud para ${a.nombre}. El área la va a revisar y te avisamos.`,
      espera: `El cupo de ${a.nombre} está completo: quedaste en lista de espera.`,
    }
    setMsg({ type: data.estado === 'activa' ? 'ok' : 'info', text: textos[data.estado] })
    setAbierta(null); setQuien(''); load()
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Actividades</h1>
          <p>Deportes, talleres culturales y propuestas de la Municipalidad.</p>
        </div>
        <Link to="/mis-actividades" className="btn btn-ghost">Mis inscripciones</Link>
      </div>
      <Mensaje msg={msg} />

      <div className="chips" role="group" aria-label="Filtrar">
        {FILTROS.map(f => (
          <button key={f.k} className={'chip' + (filtro === f.k ? ' on' : '')} onClick={() => setFiltro(f.k)}>{f.l}</button>
        ))}
      </div>
      <input type="search" placeholder="Buscar por nombre, profesor/a o lugar" value={buscar}
        onChange={e => setBuscar(e.target.value)} aria-label="Buscar actividad" />

      {visibles.length === 0 && <Vacio titulo="No hay actividades con ese filtro">Probá con otra categoría.</Vacio>}

      <div className="act-list">
        {visibles.map(a => {
          const ocup = ocupados[a.id] || 0
          const libres = a.cupo != null ? Math.max(a.cupo - ocup, 0) : null
          const yaAlguna = mias.filter(m => m.actividad_id === a.id)
          const persona = personas.find(p => p.id === quien)
          const edadMal = abierta === a.id ? avisoEdad(a, persona) : null
          const yaEsta = abierta === a.id ? inscripcionDe(a.id, quien) : null
          return (
            <article key={a.id} className="act" style={{ '--area': areaColor(a.area) }}>
              <span className="area-tag">{AREAS[a.area] ?? a.area}{a.fecha_evento ? ' · Evento' : ''}</span>
              <h3>{a.nombre}</h3>
              {a.descripcion && <p className="small muted" style={{ margin: 0 }}>{a.descripcion}</p>}
              <dl className="meta">
                <dt>Cuándo</dt><dd>{horarioTexto(a)}</dd>
                {a.sede && <><dt>Dónde</dt><dd>{a.sede.nombre}{a.sede.direccion ? `, ${a.sede.direccion}` : ''}</dd></>}
                {a.docente && <><dt>Profe</dt><dd>{a.docente}</dd></>}
                {(a.publico || edadTexto(a)) && <><dt>Para</dt><dd>{[a.publico, edadTexto(a)].filter(Boolean).join(', ')}</dd></>}
              </dl>
              {yaAlguna.length > 0 && (
                <div className="row">{yaAlguna.map(m => (
                  <span key={m.id} className="small">
                    {m.familiar_id ? familia.find(f => f.id === m.familiar_id)?.nombre : 'Vos'}: <Estado tipo="inscripcion" valor={m.estado} />
                  </span>))}
                </div>
              )}
              <div className="foot">
                <div>
                  <div className="precio">{precioTexto(a)}</div>
                  {libres != null && <div className="small" style={{ color: libres ? 'var(--muted)' : 'var(--err)' }}>
                    {libres ? `Quedan ${libres} lugares` : 'Cupo completo · lista de espera'}</div>}
                </div>
                {!a.inscripcion_abierta
                  ? <span className="pill pill-mute">Inscripción cerrada</span>
                  : abierta !== a.id && <button className="btn btn-primary" onClick={() => { setAbierta(a.id); setQuien(''); setMsg(null) }}>Inscribirme</button>}
              </div>
              {abierta === a.id && (
                <div className="form" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: '0.8rem' }}>
                  <span className="field-label">¿A quién inscribís?</span>
                  <div className="chips">
                    {personas.map(p => (
                      <button key={p.id} type="button" className={'chip' + (quien === p.id ? ' on' : '')} onClick={() => setQuien(p.id)}>{p.nombre}</button>
                    ))}
                    <Link to="/cuenta" className="chip" style={{ textDecoration: 'none' }}>+ Familiar</Link>
                  </div>
                  {edadMal && <div className="alert alert-warn">{edadMal}</div>}
                  {yaEsta && <div className="alert alert-info">Ya tiene una inscripción en esta actividad.</div>}
                  {a.requiere_aprobacion && <p className="hint" style={{ margin: 0 }}>Esta actividad requiere aprobación del área.</p>}
                  <div className="row-actions">
                    <button className="btn btn-primary" disabled={busy || !!yaEsta} onClick={() => inscribir(a)}>
                      {busy ? 'Enviando…' : a.requiere_aprobacion ? 'Enviar solicitud' : 'Confirmar inscripción'}</button>
                    <button className="btn btn-ghost" onClick={() => setAbierta(null)}>Cancelar</button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

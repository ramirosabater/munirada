import { ENLACES, TELEFONOS_UTILES, MUNICIPIO, telHref } from '../../lib/municipio'
import Icon from '../../components/Icon'

export default function Tramites() {
  const grupos = [...new Set(ENLACES.map(e => e.grupo))]
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Trámites y teléfonos</h1>
        <p>Accesos a los sistemas municipales que ya funcionan en la web.</p></div></div>
      <div className="grid-2">
        {grupos.map(g => (
          <section key={g} className="card">
            <h2>{g}</h2>
            <ul className="list">{ENLACES.filter(e => e.grupo === g).map(e => (
              <li key={e.url} className="list-item">
                <a href={e.url} target="_blank" rel="noreferrer" className="row-between" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                  <span><b>{e.titulo}</b>{e.desc && <span className="small muted"> · {e.desc}</span>}</span>
                  <span style={{ color: 'var(--celeste-hover)' }}><Icon name="externo" size={18} /></span>
                </a>
              </li>))}
            </ul>
          </section>
        ))}
      </div>
      <section className="card">
        <h2>Teléfonos útiles</h2>
        <div className="phones">{TELEFONOS_UTILES.map(t => (
          <a key={t.tel} className="phone" href={telHref(t.tel)}><span>{t.nombre}</span><strong>{t.tel}</strong></a>))}
        </div>
      </section>
      <section className="card">
        <h2>{MUNICIPIO.nombre}</h2>
        <p style={{ margin: 0 }}>{MUNICIPIO.direccion}<br />
          <a href={`mailto:${MUNICIPIO.email}`}>{MUNICIPIO.email}</a><br />
          {MUNICIPIO.telefonos.map((t, i) => <span key={t}>{i > 0 && ' / '}<a href={telHref(t)}>{t}</a></span>)}</p>
      </section>
    </div>
  )
}

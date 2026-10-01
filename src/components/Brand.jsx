import { useState } from 'react'
import { MUNICIPIO } from '../lib/municipio'

// Usa /logo-blanco.png (versión blanca del logo oficial). Si no está, muestra el nombre.
export default function Brand({ sub, big = false }) {
  const [hayLogo, setHayLogo] = useState(true)
  return (
    <div className="brand" style={big ? { flexDirection: 'column', gap: '0.4rem' } : undefined}>
      {hayLogo && (
        <img className="brand-logo" src="/logo-blanco.png" alt={MUNICIPIO.nombre}
          style={big ? { height: 64 } : undefined} onError={() => setHayLogo(false)} />
      )}
      {(!hayLogo || sub) && (
        <div className="brand-text" style={big ? { alignItems: 'center' } : undefined}>
          {!hayLogo && <span className="brand-name" style={big ? { fontSize: '1.6rem' } : undefined}>{MUNICIPIO.corto}</span>}
          {sub && <span className="brand-sub">{sub}</span>}
        </div>
      )}
    </div>
  )
}

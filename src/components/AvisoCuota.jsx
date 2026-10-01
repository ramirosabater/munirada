import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { mesActual, pesos } from '../lib/formato'

const DIA_GRACIA = 10 // hasta el día 10 no pagar todavía no es deuda

// Compara las cuotas mensuales de las inscripciones activas con lo pagado este mes.
export default function AvisoCuota() {
  const { uid } = useAuth()
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    const periodo = mesActual()
    async function calcular() {
      const [{ data: insc }, { data: pagos }] = await Promise.all([
        supabase.from('inscripciones').select('id, actividad:actividades(cuota, modalidad_pago)')
          .eq('titular_id', uid).eq('estado', 'activa'),
        supabase.from('pagos').select('estado, monto').eq('titular_id', uid).eq('periodo', periodo),
      ])
      const esperado = (insc ?? []).filter(i => i.actividad?.modalidad_pago === 'mensual')
        .reduce((s, i) => s + Number(i.actividad?.cuota || 0), 0)
      const pagado = (pagos ?? []).filter(p => p.estado === 'aprobado').reduce((s, p) => s + Number(p.monto), 0)
      const enRevision = (pagos ?? []).some(p => p.estado === 'pendiente')
      if (esperado <= 0 || pagado >= esperado) return setAviso(null)
      if (enRevision) return setAviso({ type: 'info', text: 'Tu pago de este mes está en revisión.' })
      if (pagado > 0) return setAviso({ type: 'error', text: `Te falta abonar ${pesos(esperado - pagado)} de las cuotas de este mes.` })
      if (new Date().getDate() > DIA_GRACIA) return setAviso({ type: 'error', text: `Tenés cuotas de este mes sin pagar (${pesos(esperado)}).` })
      setAviso({ type: 'warn', text: `Las cuotas de este mes suman ${pesos(esperado)}. Podés pagarlas hasta el día ${DIA_GRACIA}.` })
    }
    calcular()
  }, [uid])

  if (!aviso) return null
  return (
    <div className={'alert alert-' + aviso.type + ' row-between'}>
      <span>{aviso.text}</span>
      <Link to="/pagos" className="link-btn">Ir a pagos</Link>
    </div>
  )
}

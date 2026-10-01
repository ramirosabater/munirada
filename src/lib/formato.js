// 0=Dom … 6=Sáb, igual que Date.getDay() y extract(dow) de Postgres
export const DIAS = [
  { n: 1, c: 'Lun', l: 'Lunes' }, { n: 2, c: 'Mar', l: 'Martes' }, { n: 3, c: 'Mié', l: 'Miércoles' },
  { n: 4, c: 'Jue', l: 'Jueves' }, { n: 5, c: 'Vie', l: 'Viernes' }, { n: 6, c: 'Sáb', l: 'Sábado' }, { n: 0, c: 'Dom', l: 'Domingo' },
]
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const pad = n => String(n).padStart(2, '0')
// Fechas en hora local (no UTC): evita que a la noche "hoy" pase a ser mañana.
export const isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hoyISO = () => isoLocal(new Date())
export const mesActual = () => hoyISO().slice(0, 7)
export const aFecha = iso => new Date(iso.slice(0, 10) + 'T00:00:00')

export const hora = t => (t ? t.slice(0, 5) : '')

export function diasTexto(dias = []) {
  if (dias.length === 5 && [1, 2, 3, 4, 5].every(n => dias.includes(n))) return 'Lunes a viernes'
  return DIAS.filter(d => dias.includes(d.n)).map(d => d.c).join(', ')
}

export function fechaLarga(iso) {
  if (!iso) return ''
  const f = aFecha(iso)
  const dia = DIAS.find(d => d.n === f.getDay()).l
  return `${dia} ${f.getDate()} de ${MESES[f.getMonth()]}`
}

export function fechaCorta(iso) {
  if (!iso) return ''
  const f = iso.length <= 10 ? aFecha(iso) : new Date(iso)
  return `${pad(f.getDate())}/${pad(f.getMonth() + 1)}/${f.getFullYear()}`
}

export function periodoTexto(p) {
  if (!p) return ''
  const [y, m] = p.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}

export function horarioTexto(a) {
  if (a.fecha_evento) return `${fechaLarga(a.fecha_evento)}${a.hora_inicio ? ', ' + hora(a.hora_inicio) + ' h' : ''}`
  const d = diasTexto(a.dias || [])
  const h = a.hora_inicio ? `${hora(a.hora_inicio)}${a.hora_fin ? ' a ' + hora(a.hora_fin) : ''} h` : ''
  return [d, h].filter(Boolean).join(', ') || 'Horario a confirmar'
}

export const pesos = n => '$ ' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })

export function precioTexto(a) {
  if (!Number(a.cuota)) return 'Gratuita'
  return pesos(a.cuota) + (a.modalidad_pago === 'mensual' ? ' por mes' : '')
}

export function calcularEdad(fechaNac) {
  if (!fechaNac) return null
  const n = aFecha(fechaNac)
  const hoy = new Date()
  let e = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e--
  return e
}

export function edadTexto(a) {
  if (a.edad_min && a.edad_max) return `${a.edad_min} a ${a.edad_max} años`
  if (a.edad_min) return `Desde ${a.edad_min} años`
  if (a.edad_max) return `Hasta ${a.edad_max} años`
  return null
}

// Nombre de quien participa en una inscripción (el titular o un familiar)
export const participante = i => i?.familiar?.nombre ?? i?.titular?.full_name ?? 'Titular'

export function descargarCSV(nombre, filas) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '\uFEFF' + filas.map(f => f.map(esc).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function errorTexto(err) {
  const m = err?.message || String(err)
  if (m.includes('duplicate key') || m.includes('inscripciones_vigente_unica')) return 'Ya hay una inscripción vigente para esa persona en esta actividad.'
  if (m.includes('row-level security')) return 'No tenés permiso para hacer esto.'
  if (m.includes('Invalid login')) return 'Correo o contraseña incorrectos.'
  return m
}

// Sube un archivo a un bucket privado dentro de la carpeta del usuario
export async function subirArchivo(supabase, bucket, uid, file) {
  if (!file) return null
  const limpio = file.name.normalize('NFD').replace(/[^\w.-]/g, '_')
  const path = `${uid}/${Date.now()}-${limpio}`
  const { error } = await supabase.storage.from(bucket).upload(path, file)
  if (error) throw error
  return path
}

export async function abrirArchivo(supabase, bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 120)
  if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
}

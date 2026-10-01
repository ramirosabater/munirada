// Datos institucionales. Fuente: radatilly.gob.ar — revisalos si cambian.
export const MUNICIPIO = {
  nombre: 'Municipalidad de Rada Tilly',
  corto: 'Rada Tilly',
  direccion: 'Fragata 25 de Mayo N° 94',
  email: 'municipalidad@radatilly.gob.ar',
  telefonos: ['445-3368', '445-3369', '445-3370'],
  web: 'https://radatilly.gob.ar/',
}

// Código de área de Comodoro Rivadavia / Rada Tilly: 0297
export const telHref = t => 'tel:+54297' + t.replace(/\D/g, '')

export const TELEFONOS_UTILES = [
  { nombre: 'Policía', tel: '445-1255' },
  { nombre: 'Bomberos', tel: '445-1004' },
  { nombre: 'Defensa Civil', tel: '445-1303' },
  { nombre: 'Seguridad Urbana y Vial', tel: '445-3303' },
  { nombre: 'Centro de Salud Municipal', tel: '445-3399' },
  { nombre: 'Taller de Arte Municipal', tel: '445-1401' },
]

// Trámites que ya existen en otros sistemas municipales: la app los enlaza.
export const ENLACES = [
  { grupo: 'Pagos y tasas', titulo: 'Consulta de deuda y pagos online', url: 'https://pagos.radatilly.gob.ar/pagos/pagos.php', desc: 'Inmobiliario, automotor, comercio y más.' },
  { grupo: 'Pagos y tasas', titulo: 'E-Boleta', url: 'https://radatilly.gob.ar/e-boleta/', desc: 'Recibí tus boletas por correo.' },
  { grupo: 'Pagos y tasas', titulo: 'Medios de pago', url: 'https://radatilly.gob.ar/medios-de-pago/' },
  { grupo: 'Pagos y tasas', titulo: 'Valuación automotor', url: 'https://radatilly.gob.ar/valuacion-automotor/' },
  { grupo: 'Trámites', titulo: 'Turnos para licencia de conducir', url: 'https://turnero.radatilly.gob.ar/' },
  { grupo: 'Trámites', titulo: 'Guía de trámites', url: 'https://radatilly.gob.ar/guia-de-tramites/' },
  { grupo: 'Trámites', titulo: 'Portal ciudadano', url: 'https://munidigital.com/citizenv2/radatilly/informacion' },
  { grupo: 'Trámites', titulo: 'Inscripción de alquileres temporarios', url: 'https://forms.munidigital.com/publico/contestar/QqSEfKyL1SqYhmm9ZvwC' },
  { grupo: 'Trámites', titulo: 'Estacionamiento medido', url: 'https://radatilly.gob.ar/estacionamiento-medido/' },
  { grupo: 'Ciudad', titulo: 'Puntos limpios', url: 'https://radatilly.gob.ar/puntos-limpios/', desc: 'Dónde llevar reciclables.' },
  { grupo: 'Ciudad', titulo: 'Mapa de espacios verdes', url: 'https://www.google.com/maps/d/u/0/viewer?mid=1Q3aRygsdOBZ5QqAwlJEA-CZRT13TcNwo' },
  { grupo: 'Ciudad', titulo: 'Servicio de poda', url: 'https://radatilly.gob.ar/servicio-de-poda/' },
  { grupo: 'Ciudad', titulo: 'Centro de Salud Dr. René Favaloro', url: 'https://radatilly.gob.ar/secretaria-de-desarrollo-social-y-salud-centro-salud/' },
  { grupo: 'Gobierno', titulo: 'Boletín oficial', url: 'https://radatilly.gob.ar/boletin-oficial/' },
  { grupo: 'Gobierno', titulo: 'Licitaciones', url: 'https://radatilly.gob.ar/licitaciones/' },
  { grupo: 'Gobierno', titulo: 'Concejo Deliberante', url: 'https://concejoradatilly.gob.ar/' },
]

// Datos para transferir cuotas. Completalos para que aparezcan en "Mis pagos".
export const DATOS_TRANSFERENCIA = {
  titular: '',   // ej. 'Municipalidad de Rada Tilly'
  cuit: '',
  alias: '',
  cbu: '',
}

export const AREAS = {
  deportes: 'Deportes y Turismo',
  cultura: 'Cultura',
  desarrollo_social: 'Desarrollo Social y Salud',
  ambiente: 'Ambiente',
  obras: 'Obras Públicas',
  seguridad: 'Seguridad Urbana y Vial',
  hacienda: 'Hacienda',
  gobierno: 'Gobierno',
  modernizacion: 'Modernización',
}
// Áreas que ofrecen actividades con inscripción
export const AREAS_ACTIVIDADES = ['deportes', 'cultura', 'desarrollo_social']

export const areaColor = a => `var(--area-${a}, var(--celeste))`

export const ROLES = {
  vecino: 'Vecino/a',
  profesor: 'Profesor/a',
  agente: 'Agente municipal',
  admin: 'Administración',
}

export const METODOS_PAGO = ['transferencia', 'mercadopago', 'efectivo', 'tarjeta', 'otro']

// [etiqueta, color de pill]
export const ESTADOS = {
  inscripcion: {
    activa: ['Inscripto/a', 'ok'], pendiente: ['Pendiente de aprobación', 'warn'],
    espera: ['Lista de espera', 'info'], baja: ['Dado/a de baja', 'mute'], rechazada: ['No aceptada', 'off'],
  },
  pago: { pendiente: ['En revisión', 'warn'], aprobado: ['Aprobado', 'ok'], rechazado: ['Rechazado', 'off'] },
  reclamo: { recibido: ['Recibido', 'info'], en_curso: ['En curso', 'warn'], resuelto: ['Resuelto', 'ok'], rechazado: ['No corresponde', 'off'] },
  turno: { confirmado: ['Confirmado', 'ok'], cancelado: ['Cancelado', 'mute'], atendido: ['Atendido', 'info'], ausente: ['Ausente', 'off'] },
}

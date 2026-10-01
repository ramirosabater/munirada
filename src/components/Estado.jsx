import { ESTADOS } from '../lib/municipio'

export default function Estado({ tipo, valor }) {
  const [txt, color] = ESTADOS[tipo]?.[valor] ?? [valor, 'mute']
  return <span className={'pill pill-' + color}>{txt}</span>
}

export function Vacio({ titulo, children }) {
  return <div className="empty"><strong>{titulo}</strong>{children}</div>
}

export function Mensaje({ msg }) {
  if (!msg) return null
  return <div className={'alert alert-' + msg.type} role={msg.type === 'error' ? 'alert' : 'status'}>{msg.text}</div>
}

// Borde de costa: la línea donde el azul del Golfo se encuentra con la página.
export default function Shore({ color = 'var(--bg)' }) {
  return (
    <svg className="shore" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 30 C 180 6, 360 6, 540 24 S 900 46, 1080 26 S 1320 4, 1440 20 L1440 48 L0 48 Z"
        fill="rgba(255,255,255,0.12)" />
      <path d="M0 38 C 200 20, 380 22, 560 34 S 920 50, 1100 36 S 1330 22, 1440 32 L1440 48 L0 48 Z"
        fill={color} />
    </svg>
  )
}

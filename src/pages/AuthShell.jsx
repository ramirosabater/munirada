import Brand from '../components/Brand'
import Shore from '../components/Shore'

export default function AuthShell({ titulo, bajada, children }) {
  return (
    <div className="auth-wrap">
      <header className="auth-hero">
        <div style={{ display: 'flex', justifyContent: 'center' }}><Brand big /></div>
        <Shore />
      </header>
      <div className="auth-body">
        <div className="auth-card">
          <h1 style={{ marginBottom: '0.2rem' }}>{titulo}</h1>
          {bajada && <p className="muted" style={{ marginBottom: '1.2rem' }}>{bajada}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

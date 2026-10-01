import Brand from '../components/Brand'
import Shore from '../components/Shore'

export default function AuthShell({ titulo, bajada, children }) {
  return (
    <div className="auth-wrap">
      <header className="auth-hero">
        <div style={{ display: 'flex', justifyContent: 'center' }}><Brand big /></div>
        <h1>{titulo}</h1>
        {bajada && <p>{bajada}</p>}
        <Shore />
      </header>
      <div className="auth-body">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  )
}

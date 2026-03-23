import { useState } from 'react'

type Props = {
  onLogin: (user: string, password: string) => void
  error?: string
}

function LoginPage({ onLogin, error }: Props) {
  const [user, setUser] = useState(localStorage.getItem('admin_user') || 'admin')
  const [password, setPassword] = useState('')

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#0b1118', color: '#e8edf2' }}>
      <div style={{ width: 360, padding: 24, borderRadius: 16, background: '#101826', border: '1px solid #1f2b3a' }}>
        <h2 style={{ marginTop: 0 }}>Вход в админку</h2>
        <div style={{ marginBottom: 12, color: '#8da2b5', fontSize: '0.95rem' }}>
          Введите логин и пароль администратора.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="form-section-title">Логин</div>
            <input className="input" value={user} onChange={(e) => setUser(e.target.value)} autoFocus />
          </div>
          <div>
            <div className="form-section-title">Пароль</div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</div>}
          <button className="button" onClick={() => onLogin(user, password)}>Войти</button>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

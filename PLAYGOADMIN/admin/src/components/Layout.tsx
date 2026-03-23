import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

const navItems = [
  { to: '/cities', label: 'Города' },
  { to: '/stadiums', label: 'Стадионы' },
  { to: '/matches', label: 'Матчи' },
  { to: '/users', label: 'Пользователи' },
  { to: '/teams', label: 'Команды' },
  { to: '/registrations', label: 'Заявки' },
]

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo-block">
          <span style={{ fontSize: 22 }}>⚽</span>
          <div>
            <div>PlayGo Admin</div>
            <div style={{ color: '#8da2b5', fontSize: 12 }}>управление матчами</div>
          </div>
        </div>
        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.to} className="nav-item">
              <NavLink to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}

export default Layout

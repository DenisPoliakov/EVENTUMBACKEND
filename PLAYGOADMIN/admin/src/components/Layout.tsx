import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { api } from '../api/client'
import type { Sport } from '../types'

const footballNavItems = [
  { to: '/stadiums', label: 'Стадионы' },
  { to: '/matches', label: 'Матчи' },
  { to: '/teams', label: 'Команды' },
  { to: '/registrations', label: 'Заявки' },
]

const ecosystemNavItems = [
  { to: '/clubs', label: 'Клубы и залы' },
  { to: '/subscription-plans', label: 'Абонементы' },
  { to: '/subscriptions', label: 'Оплаты' },
  { to: '/bookings', label: 'Бронирования' },
]

const commonNavItems = [
  { to: '/premium', label: 'Premium' },
  { to: '/orders', label: 'Заказы YooKassa' },
  { to: '/crm', label: 'CRM' },
  { to: '/cities', label: 'Города' },
  { to: '/users', label: 'Пользователи' },
  { to: '/news', label: 'Новости' },
  { to: '/wellness-stories', label: 'Wellness-истории' },
  { to: '/workout-programs', label: 'Программы тренировок' },
  { to: '/workout-analytics', label: 'Аналитика тренировок' },
  { to: '/push-campaigns', label: 'Push-кампании' },
  { to: '/support', label: 'Поддержка' },
  { to: '/sports', label: 'Виды спорта' },
]

const fallbackSports: Sport[] = [
  { id: 'football', code: 'FOOTBALL', name: 'Футбол' },
  { id: 'boxing', code: 'BOXING', name: 'Бокс' },
]

function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sports, setSports] = useState<Sport[]>(fallbackSports)
  const [selectedSportCode, setSelectedSportCode] = useState(
    () => localStorage.getItem('admin_selected_sport') || 'FOOTBALL',
  )

  useEffect(() => {
    const loadSports = async () => {
      try {
        const res = await api.get('/sports')
        const loaded = res.data as Sport[]
        if (loaded.length) {
          setSports(loaded)
          if (!loaded.some((sport) => sport.code === selectedSportCode)) {
            setSelectedSportCode(loaded[0].code)
            localStorage.setItem('admin_selected_sport', loaded[0].code)
          }
        }
      } catch {
        setSports(fallbackSports)
      }
    }
    loadSports()
  }, [selectedSportCode])

  const selectedSport = sports.find((sport) => sport.code === selectedSportCode) || sports[0]
  const sportNavItems = selectedSportCode === 'FOOTBALL' ? footballNavItems : ecosystemNavItems
  const allowedRoutes = useMemo(
    () => new Set([...sportNavItems, ...commonNavItems].map((item) => item.to)),
    [sportNavItems],
  )

  useEffect(() => {
    if (allowedRoutes.has(location.pathname)) return
    navigate(selectedSportCode === 'FOOTBALL' ? '/stadiums' : '/clubs', { replace: true })
  }, [allowedRoutes, location.pathname, navigate, selectedSportCode])

  const handleSportChange = (code: string) => {
    setSelectedSportCode(code)
    localStorage.setItem('admin_selected_sport', code)
    navigate(code === 'FOOTBALL' ? '/stadiums' : '/clubs')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo-block">
          <span style={{ fontSize: 22 }}>⚽</span>
          <div>
            <div>PlayGo Admin</div>
            <div style={{ color: '#8da2b5', fontSize: 12 }}>управление eventum</div>
          </div>
        </div>
        <div>
          <div className="small-label" style={{ marginBottom: 8 }}>Разделы спорта</div>
          <div className="active-sport-card">
            <div>{selectedSport?.name || 'Вид спорта'}</div>
            <span>{selectedSport?.code || 'SPORT'}</span>
          </div>
        </div>
        <ul className="nav-list">
          {sportNavItems.map((item) => (
            <li key={item.to} className="nav-item">
              <NavLink to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="nav-divider" />
        <ul className="nav-list">
          {commonNavItems.map((item) => (
            <li key={item.to} className="nav-item">
              <NavLink to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>
      <main className="main">
        <div className="sport-switcher">
          <div>
            <div className="small-label">Текущий вид спорта</div>
            <strong>{selectedSport?.name || 'Футбол'}</strong>
          </div>
          <div className="sport-tabs">
            {sports.map((sport) => (
              <button
                key={sport.id}
                type="button"
                className={`sport-tab ${sport.code === selectedSportCode ? 'active' : ''}`}
                onClick={() => handleSportChange(sport.code)}
              >
                {sport.name}
              </button>
            ))}
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}

export default Layout

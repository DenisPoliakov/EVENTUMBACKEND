import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AdminProductProvider, type AdminProductCode } from '../productContext'

const footballNavItems = [
  { to: '/stadiums', label: 'Стадионы' },
  { to: '/matches', label: 'Матчи' },
  { to: '/teams', label: 'Команды' },
  { to: '/registrations', label: 'Заявки' },
]

const clubsNavItems = [
  { to: '/clubs', label: 'Клубы и залы' },
  { to: '/coach-club-links', label: 'Заявки тренеров' },
  { to: '/subscription-plans', label: 'Абонементы' },
  { to: '/subscriptions', label: 'Оплаты' },
  { to: '/bookings', label: 'Бронирования' },
  { to: '/wellness-stories', label: 'Wellness-истории' },
  { to: '/workout-programs', label: 'Программы тренировок' },
  { to: '/workout-analytics', label: 'Аналитика тренировок' },
]

const commonNavItems = [
  { to: '/premium', label: 'Premium' },
  { to: '/orders', label: 'Заказы YooKassa' },
  { to: '/crm', label: 'CRM' },
  { to: '/cities', label: 'Города' },
  { to: '/users', label: 'Пользователи' },
  { to: '/news', label: 'Новости' },
  { to: '/push-campaigns', label: 'Push-кампании' },
  { to: '/support', label: 'Поддержка' },
]

const products = [
  { code: 'FOOTBALL', name: 'EVENTUM FOOTBALL', icon: '⚽' },
  { code: 'CLUBS', name: 'EVENTUM CLUBS', icon: '🥊' },
] as const

const initialProduct = (): AdminProductCode => {
  const saved = localStorage.getItem('admin_selected_product')
  if (saved === 'FOOTBALL' || saved === 'CLUBS') return saved
  return localStorage.getItem('admin_selected_sport') === 'FOOTBALL'
    ? 'FOOTBALL'
    : 'CLUBS'
}

function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedProductCode, setSelectedProductCode] =
    useState<AdminProductCode>(initialProduct)
  const selectedProduct =
    products.find((product) => product.code === selectedProductCode) || products[0]
  const productNavItems =
    selectedProductCode === 'FOOTBALL' ? footballNavItems : clubsNavItems
  const allowedRoutes = useMemo(
    () => new Set([...productNavItems, ...commonNavItems].map((item) => item.to)),
    [productNavItems],
  )

  useEffect(() => {
    if (allowedRoutes.has(location.pathname)) return
    navigate(selectedProductCode === 'FOOTBALL' ? '/stadiums' : '/clubs', {
      replace: true,
    })
  }, [allowedRoutes, location.pathname, navigate, selectedProductCode])

  const handleProductChange = (code: AdminProductCode) => {
    setSelectedProductCode(code)
    localStorage.setItem('admin_selected_product', code)
    localStorage.removeItem('admin_selected_sport')
    navigate(code === 'FOOTBALL' ? '/stadiums' : '/clubs')
  }

  return (
    <AdminProductProvider value={selectedProductCode}>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="logo-block">
            <span style={{ fontSize: 22 }}>{selectedProduct.icon}</span>
            <div>
              <div>EVENTUM Admin</div>
              <div style={{ color: '#8da2b5', fontSize: 12 }}>единая экосистема</div>
            </div>
          </div>
          <div>
            <div className="small-label" style={{ marginBottom: 8 }}>Текущий сервис</div>
            <div className="active-sport-card">
              <div>{selectedProduct.name}</div>
              <span>{selectedProduct.code}</span>
            </div>
          </div>
          <ul className="nav-list">
            {productNavItems.map((item) => (
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
              <div className="small-label">Текущий сервис</div>
              <strong>{selectedProduct.name}</strong>
            </div>
            <div className="sport-tabs">
              {products.map((product) => (
                <button
                  key={product.code}
                  type="button"
                  className={`sport-tab ${product.code === selectedProductCode ? 'active' : ''}`}
                  onClick={() => handleProductChange(product.code)}
                >
                  {product.name}
                </button>
              ))}
            </div>
          </div>
          {children}
        </main>
      </div>
    </AdminProductProvider>
  )
}

export default Layout

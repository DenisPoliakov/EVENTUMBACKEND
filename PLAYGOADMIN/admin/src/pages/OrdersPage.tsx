import dayjs from 'dayjs'
import { useState } from 'react'

import { useClubs, useOrders } from '../api/hooks'
import Select from '../components/Select'

function OrdersPage() {
  const [filters, setFilters] = useState({
    clubId: '',
    status: '',
    paymentStatus: '',
  })
  const { data: clubs } = useClubs({})
  const { data: orders } = useOrders({
    clubId: filters.clubId || undefined,
    status: filters.status || undefined,
    paymentStatus: filters.paymentStatus || undefined,
  })

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Экосистема</div>
          <h2 style={{ margin: '4px 0 0' }}>Заказы и платежи</h2>
        </div>
        <div className="actions-row">
          <div style={{ minWidth: 180 }}>
            <Select value={filters.clubId} onChange={(clubId) => setFilters({ ...filters, clubId })} options={[{ value: '', label: 'Все клубы' }, ...(clubs || []).map((club) => ({ value: club.id, label: club.name }))]} />
          </div>
          <div style={{ minWidth: 180 }}>
            <Select value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={[{ value: '', label: 'Все заказы' }, ...['PENDING', 'PAYMENT_CREATED', 'PAID', 'CANCELLED', 'FAILED'].map((value) => ({ value, label: value }))]} />
          </div>
          <div style={{ minWidth: 180 }}>
            <Select value={filters.paymentStatus} onChange={(paymentStatus) => setFilters({ ...filters, paymentStatus })} options={[{ value: '', label: 'Все платежи' }, ...['PENDING', 'SUCCEEDED', 'CANCELLED', 'FAILED'].map((value) => ({ value, label: value }))]} />
          </div>
        </div>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>Создан</th><th>Пользователь</th><th>Клуб / тариф</th><th>Сумма</th><th>Заказ</th><th>Платёж</th><th>YooKassa ID</th></tr></thead>
          <tbody>
            {orders?.map((order) => (
              <tr key={order.id}>
                <td>{dayjs(order.createdAt).format('DD.MM.YYYY HH:mm')}</td>
                <td>{order.user?.username || order.user?.email || order.userId}</td>
                <td>{order.type === 'PREMIUM' ? 'Premium' : order.club?.name || '—'}<br /><span className="small-label">{order.premiumPlan?.title || order.plan?.title || order.planId}</span></td>
                <td>{(order.amountCents / 100).toFixed(2)} {order.currency}</td>
                <td>{order.status}</td>
                <td>{order.payment?.status || '—'}</td>
                <td>{order.payment?.externalId || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default OrdersPage

import dayjs from 'dayjs'
import { useState } from 'react'
import { api } from '../api/client'
import { useClubs, useSports, useSubscriptions } from '../api/hooks'
import Select from '../components/Select'

function SubscriptionsPage() {
  const { data: sports } = useSports()
  const [filters, setFilters] = useState({ sportId: '', clubId: '', status: '' })
  const { data: clubs } = useClubs({ sportId: filters.sportId || undefined })
  const { data: subscriptions, refetch } = useSubscriptions({
    sportId: filters.sportId || undefined,
    clubId: filters.clubId || undefined,
    status: filters.status || undefined,
  })

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/subscriptions/${id}/status`, { status })
    await refetch()
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Экосистема</div>
          <h2 style={{ margin: '4px 0 0' }}>Оплаты и абонементы пользователей</h2>
        </div>
        <div className="actions-row">
          <div style={{ minWidth: 190 }}>
            <Select value={filters.sportId} onChange={(sportId) => setFilters({ ...filters, sportId, clubId: '' })} options={[{ value: '', label: 'Все виды спорта' }, ...(sports || []).map((s) => ({ value: s.id, label: s.name }))]} />
          </div>
          <div style={{ minWidth: 190 }}>
            <Select value={filters.clubId} onChange={(clubId) => setFilters({ ...filters, clubId })} options={[{ value: '', label: 'Все клубы' }, ...(clubs || []).map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <div style={{ minWidth: 160 }}>
            <Select value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={[{ value: '', label: 'Все статусы' }, { value: 'ACTIVE', label: 'Активные' }, { value: 'EXPIRED', label: 'Истекшие' }, { value: 'CANCELLED', label: 'Отмененные' }]} />
          </div>
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Спорт</th>
              <th>Клуб</th>
              <th>Абонемент</th>
              <th>Срок</th>
              <th>Сумма</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {subscriptions?.map((sub) => (
              <tr key={sub.id}>
                <td>{sub.user?.username || sub.user?.email || sub.userId}</td>
                <td>{sub.sport?.name || '—'}</td>
                <td>{sub.club?.name || '—'}</td>
                <td>{sub.plan?.title || '—'}</td>
                <td>
                  {dayjs(sub.startsAt).format('DD.MM.YYYY')} — {dayjs(sub.expiresAt).format('DD.MM.YYYY')}
                </td>
                <td>{(sub.amountCents / 100).toFixed(2)} {sub.currency}</td>
                <td>{sub.status}</td>
                <td className="text-right">
                  <div className="table-actions">
                    {sub.status !== 'ACTIVE' && <button className="button" type="button" onClick={() => updateStatus(sub.id, 'ACTIVE')}>Активировать</button>}
                    {sub.status !== 'CANCELLED' && <button className="button button-danger" type="button" onClick={() => updateStatus(sub.id, 'CANCELLED')}>Отменить</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SubscriptionsPage

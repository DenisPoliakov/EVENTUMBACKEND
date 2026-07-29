import { useMemo, useState } from 'react'

import { useBookings, useClubs, usePatchMutation } from '../api/hooks'
import Select from '../components/Select'
import type { TrainingBooking, TrainingBookingStatus } from '../types'

const statusOptions = [
  { value: '', label: 'Все статусы' },
  { value: 'PENDING', label: 'Ожидает' },
  { value: 'CONFIRMED', label: 'Подтверждено' },
  { value: 'COMPLETED', label: 'Завершено' },
  { value: 'CANCELLED', label: 'Отменено' },
]

function BookingsPage() {
  const [filters, setFilters] = useState({ clubId: '', status: '' })
  const { data: clubs } = useClubs({})
  const { data: bookings } = useBookings({
    clubId: filters.clubId || undefined,
    status: filters.status || undefined,
  })
  const updateStatus = usePatchMutation(
    (payload) => `/bookings/${payload.id}/status`,
    ['bookings'],
  )
  const clubOptions = useMemo(
    () => [
      { value: '', label: 'Все клубы' },
      ...(clubs || []).map((club) => ({ value: club.id, label: club.name })),
    ],
    [clubs],
  )

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Экосистема</div>
          <h2 style={{ margin: '4px 0 0' }}>Бронирования тренировок</h2>
        </div>
        <div className="actions-row">
          <div style={{ minWidth: 220 }}>
            <Select
              value={filters.clubId}
              onChange={(clubId) => setFilters({ ...filters, clubId })}
              options={clubOptions}
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <Select
              value={filters.status}
              onChange={(status) => setFilters({ ...filters, status })}
              options={statusOptions}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Занятие</th>
              <th>Клиент</th>
              <th>Клуб</th>
              <th>Дата</th>
              <th>Цена / комиссия</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {bookings?.map((booking: TrainingBooking) => (
              <tr key={booking.id}>
                <td>{booking.scheduleTitle}</td>
                <td>{booking.user?.name || booking.user?.email || booking.userId}</td>
                <td>{booking.clubName || booking.club?.name || booking.clubId}</td>
                <td>{new Date(booking.scheduledAt).toLocaleString('ru-RU')}</td>
                <td>
                  {(booking.priceCents / 100).toFixed(2)} {booking.currency}
                  <div className="small-label">
                    комиссия {(booking.platformFeeCents / 100).toFixed(2)}
                  </div>
                </td>
                <td style={{ minWidth: 180 }}>
                  <Select
                    value={booking.status}
                    onChange={(status) =>
                      updateStatus.mutate({
                        id: booking.id,
                        status: status as TrainingBookingStatus,
                      })
                    }
                    options={statusOptions.slice(1)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BookingsPage

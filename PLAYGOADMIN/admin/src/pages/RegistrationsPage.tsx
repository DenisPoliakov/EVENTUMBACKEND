import { useState } from 'react'
import { useDeleteMutation, useMatches, usePatchMutation, useRegistrations } from '../api/hooks'
import type { MatchRegistration } from '../types'
import Select from '../components/Select'

function RegistrationsPage() {
  const [matchFilter, setMatchFilter] = useState('')
  const { data: registrations } = useRegistrations(matchFilter || undefined)
  const { data: matches } = useMatches({ cityId: undefined, stadiumId: undefined, status: undefined })
  const updateStatus = usePatchMutation(
    (payload) => `/registrations/${payload.id}/status`,
    ['registrations', ['matches']]
  )
  const deleteRegistration = useDeleteMutation((id) => `/registrations/${id}`, ['registrations', ['matches']])

  const action = (id: string, status: 'APPROVED' | 'REJECTED') => updateStatus.mutate({ id, status })

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Модерация</div>
          <h2 style={{ margin: '4px 0 0' }}>Заявки на матчи</h2>
        </div>
        <div style={{ minWidth: 260 }}>
          <Select
            value={matchFilter}
            onChange={setMatchFilter}
            placeholder="Все матчи"
            options={[{ value: '', label: 'Все матчи' }, ...(matches || []).map((m) => ({ value: m.id, label: `${m.stadium?.name || ''} · ${new Date(m.startTime).toLocaleString()}` }))]}
          />
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Команда / капитан</th>
              <th>Матч</th>
              <th>Город / Стадион</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {registrations?.map((reg: MatchRegistration) => (
              <tr key={reg.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{reg.teamName}</div>
                  <div className="small-label">Капитан: {reg.captainName}</div>
                  <div className="small-label">Логин: {reg.captainLogin}</div>
                  {reg.playersCount !== null && reg.playersCount !== undefined && (
                    <div className="small-label">Игроков: {reg.playersCount}</div>
                  )}
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{reg.match?.stadium?.name}</div>
                  <div className="small">{new Date(reg.match?.startTime || '').toLocaleString()}</div>
                </td>
                <td>
                  <div className="small-label">{reg.match?.stadium?.city?.name}</div>
                  <div className="small">{reg.match?.stadium?.name}</div>
                </td>
                <td>
                  <span className={`badge ${reg.status === 'PENDING' ? 'tag-muted' : ''}`}>
                    {reg.status === 'PENDING' && 'Ожидает'}
                    {reg.status === 'APPROVED' && 'Принята'}
                    {reg.status === 'REJECTED' && 'Отклонена'}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button className="button" type="button" onClick={() => action(reg.id, 'APPROVED')} disabled={updateStatus.isPending}>
                      Принять
                    </button>
                    <button
                      className="button button-danger"
                      type="button"
                      onClick={() => action(reg.id, 'REJECTED')}
                      disabled={updateStatus.isPending}
                    >
                      Отклонить
                    </button>
                    <button
                      className="button button-muted"
                      type="button"
                      onClick={() => deleteRegistration.mutate(reg.id)}
                      disabled={deleteRegistration.isPending}
                    >
                      Удалить
                    </button>
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

export default RegistrationsPage

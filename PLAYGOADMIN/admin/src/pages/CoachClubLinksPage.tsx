import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'

import { api } from '../api/client'
import Select from '../components/Select'

type CoachClubLinkRequest = {
  id: string
  status: string
  note?: string
  club?: { id: string; name: string; city?: string } | null
  coachProfile?: {
    id: string
    firstName: string
    lastName: string
  } | null
  coachUser?: {
    email: string
    username?: string
    phone?: string
  } | null
  createdAt: string
}

function CoachClubLinksPage() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('PENDING')
  const { data: requests = [], isLoading } = useQuery<CoachClubLinkRequest[]>({
    queryKey: ['coach-club-link-requests', status],
    queryFn: async () =>
      (await api.get('/coach-club-link-requests', { params: { status } })).data,
  })

  const approve = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/coach-club-link-requests/${id}/approve`)).data,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['coach-club-link-requests'] }),
  })
  const reject = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/coach-club-link-requests/${id}/reject`)).data,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['coach-club-link-requests'] }),
  })

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">EVENTUM CLUBS</div>
          <h2 style={{ margin: '4px 0 0' }}>Заявки тренеров в клубы</h2>
        </div>
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: 'PENDING', label: 'Ожидают' },
            { value: 'APPROVED', label: 'Одобренные' },
            { value: 'REJECTED', label: 'Отклонённые' },
            { value: 'CANCELLED', label: 'Отменённые' },
            { value: 'ALL', label: 'Все' },
          ]}
        />
      </div>

      <div className="panel">
        {isLoading ? (
          <p className="small-label">Загрузка…</p>
        ) : requests.length === 0 ? (
          <p className="small-label">Заявок нет.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Тренер</th>
                <th>Клуб</th>
                <th>Статус</th>
                <th>Дата</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>
                      {request.coachProfile?.firstName}{' '}
                      {request.coachProfile?.lastName}
                    </strong>
                    <div className="small-label">
                      {request.coachUser?.email ||
                        request.coachUser?.username ||
                        '—'}
                      {request.coachUser?.phone
                        ? ` · ${request.coachUser.phone}`
                        : ''}
                    </div>
                  </td>
                  <td>
                    {request.club?.name || '—'}
                    {request.club?.city ? (
                      <div className="small-label">{request.club.city}</div>
                    ) : null}
                  </td>
                  <td>{request.status}</td>
                  <td>{dayjs(request.createdAt).format('DD.MM.YYYY HH:mm')}</td>
                  <td>
                    {request.status === 'PENDING' ? (
                      <div className="actions-row">
                        <button
                          className="button"
                          disabled={approve.isPending || reject.isPending}
                          onClick={() => approve.mutate(request.id)}
                        >
                          Одобрить
                        </button>
                        <button
                          className="button button-muted"
                          disabled={approve.isPending || reject.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Отклонить заявку на привязку к клубу?',
                              )
                            ) {
                              reject.mutate(request.id)
                            }
                          }}
                        >
                          Отклонить
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default CoachClubLinksPage

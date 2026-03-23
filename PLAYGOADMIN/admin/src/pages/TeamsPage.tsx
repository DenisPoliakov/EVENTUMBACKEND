import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCities, useDeleteMutation, usePostMutation, usePutMutation, useTeams } from '../api/hooks'
import type { Team } from '../types'
import Select from '../components/Select'

function TeamsPage() {
  const { data: cities } = useCities()
  const [cityId, setCityId] = useState('')
  const { data: teams } = useTeams(cityId || undefined)
  const invalidateKey = ['teams', cityId || undefined]
  const createTeam = usePostMutation('/teams', [invalidateKey])
  const updateTeam = usePutMutation((payload) => `/teams/${payload.id}`, [invalidateKey])
  const deleteTeam = useDeleteMutation((id) => `/teams/${id}`, [invalidateKey])

  const [form, setForm] = useState({ name: '', captainUserId: '' })
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name || !cityId || !form.captainUserId) return
    if (editingId) {
      updateTeam.mutate({ id: editingId, ...form, cityId })
    } else {
      createTeam.mutate({ ...form, cityId })
    }
    setEditingId(null)
    setForm({ name: '', captainUserId: '' })
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Команды</div>
          <h2 style={{ margin: '4px 0 0' }}>Команды</h2>
        </div>
        <div style={{ minWidth: 220 }}>
          <Select
            value={cityId}
            onChange={setCityId}
            placeholder="Все города"
            options={[{ value: '', label: 'Все города' }, ...(cities || []).map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
      </div>

      <div className="panel">
        <form onSubmit={handleSubmit} className="form-grid">
          <div>
            <div className="form-section-title">Город</div>
            <Select
              value={cityId}
              onChange={setCityId}
              placeholder="Выберите"
              options={[{ value: '', label: 'Выберите' }, ...(cities || []).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div>
            <div className="form-section-title">Название команды</div>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Капитан (userId)</div>
            <input
              className="input"
              value={form.captainUserId}
              onChange={(e) => setForm({ ...form, captainUserId: e.target.value })}
              placeholder="временно вручную"
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="button" type="submit" disabled={createTeam.isPending || updateTeam.isPending}>
              {editingId ? 'Сохранить команду' : 'Создать команду'}
            </button>
            {editingId && (
              <button
                className="button"
                type="button"
                style={{ background: '#6b7280', color: '#fff', marginLeft: 8 }}
                onClick={() => {
                  setEditingId(null)
                  setForm({ name: '', captainUserId: '' })
                }}
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Город</th>
              <th>Капитан</th>
              <th>Участников</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {teams?.map((team: Team) => (
              <tr key={team.id}>
                <td>{team.name}</td>
                <td>{team.city?.name ?? '—'}</td>
                <td>{team.captain?.name ?? team.captainUserId}</td>
                <td>{team.members?.length ?? 1}</td>
                <td className="text-right">
                  <div className="table-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        setEditingId(team.id)
                        setCityId(team.cityId)
                        setForm({ name: team.name, captainUserId: team.captainUserId })
                      }}
                    >
                      Редактировать
                    </button>
                    <button
                      className="button button-danger"
                      type="button"
                      onClick={() => deleteTeam.mutate(team.id)}
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

export default TeamsPage

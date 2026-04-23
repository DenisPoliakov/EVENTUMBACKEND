import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDeleteMutation, usePostMutation, usePutMutation, useSports } from '../api/hooks'
import type { Sport } from '../types'

function SportsPage() {
  const { data: sports } = useSports()
  const createSport = usePostMutation('/sports', ['sports'])
  const updateSport = usePutMutation((payload) => `/sports/${payload.id}`, ['sports'])
  const deleteSport = useDeleteMutation((id) => `/sports/${id}`, ['sports'])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', name: '', description: '' })

  const reset = () => {
    setEditingId(null)
    setForm({ code: '', name: '', description: '' })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim()) return
    if (editingId) updateSport.mutate({ id: editingId, ...form })
    else createSport.mutate(form)
    reset()
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Экосистема</div>
          <h2 style={{ margin: '4px 0 0' }}>Виды спорта</h2>
        </div>
      </div>

      <div className="panel">
        <form className="form-grid" onSubmit={submit}>
          <div>
            <div className="form-section-title">Код</div>
            <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="FOOTBALL" />
          </div>
          <div>
            <div className="form-section-title">Название</div>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Футбол" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Описание</div>
            <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="button" type="submit">
              {editingId ? 'Сохранить' : 'Добавить'}
            </button>
            {editingId && (
              <button className="button button-muted" type="button" onClick={reset}>
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
              <th>Код</th>
              <th>Название</th>
              <th>Описание</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sports?.map((sport: Sport) => (
              <tr key={sport.id}>
                <td>{sport.code}</td>
                <td>{sport.name}</td>
                <td>{sport.description || '—'}</td>
                <td className="text-right">
                  <div className="table-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        setEditingId(sport.id)
                        setForm({
                          code: sport.code,
                          name: sport.name,
                          description: sport.description || '',
                        })
                      }}
                    >
                      Редактировать
                    </button>
                    <button className="button button-danger" type="button" onClick={() => deleteSport.mutate(sport.id)}>
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

export default SportsPage

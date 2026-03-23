import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import dayjs from 'dayjs'
import { useCities, useDeleteMutation, useMatches, usePostMutation, usePutMutation, useStadiums } from '../api/hooks'
import type { Match } from '../types'
import Select from '../components/Select'

const formatLabels: Record<Match['format'], string> = {
  FIVE_X_FIVE: '5 x 5',
  SEVEN_X_SEVEN: '7 x 7',
  ELEVEN_X_ELEVEN: '11 x 11',
}

const statusLabels: Record<Match['status'], string> = {
  DRAFT: 'Черновик',
  OPEN: 'Открыт',
  FULL: 'Заполнен',
  FINISHED: 'Завершён',
  CANCELLED: 'Отменён',
}

const approvalModeLabels: Record<Match['approvalMode'], string> = {
  MANUAL: 'Ручная модерация',
  AUTO_FIRST_COME: 'Автопринятие первых заявок',
}

function MatchesPage() {
  const { data: cities } = useCities()
  const [cityId, setCityId] = useState('')
  const { data: stadiums } = useStadiums(cityId || undefined)
  const [stadiumId, setStadiumId] = useState('')
  const [filters, setFilters] = useState<{ status?: string }>({})
  const { data: matches } = useMatches({ cityId: cityId || undefined, stadiumId: stadiumId || undefined, status: filters.status })
  const createMatch = usePostMutation('/matches', ['matches'])
  const updateMatch = usePutMutation((payload) => `/matches/${payload.id}`, ['matches'])
  const deleteMatch = useDeleteMutation((id) => `/matches/${id}`, ['matches'])

  const [form, setForm] = useState({
    stadiumId: '',
    startTime: '',
    endTime: '',
    format: 'FIVE_X_FIVE' as Match['format'],
    maxTeams: '8',
    priceRub: '',
    currency: 'RUB',
    status: 'DRAFT' as Match['status'],
    approvalMode: 'MANUAL' as Match['approvalMode'],
    description: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  const availableStadiums = useMemo(() => (cityId ? stadiums?.filter((s) => s.cityId === cityId) : stadiums), [stadiums, cityId])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.stadiumId || !form.startTime || !form.endTime) return
    const maxTeamsNum = Number(form.maxTeams)
    const priceRubNum = parseFloat(form.priceRub || '0')
    if (editingId) {
      updateMatch.mutate({
        id: editingId,
        ...form,
        maxTeams: maxTeamsNum || 0,
        priceCents: Math.round((priceRubNum || 0) * 100),
      })
    } else {
      createMatch.mutate({
        ...form,
        maxTeams: maxTeamsNum || 0,
        priceCents: Math.round((priceRubNum || 0) * 100),
      })
    }
    setEditingId(null)
    setForm((f) => ({
      ...f,
      description: '',
      priceRub: '',
      maxTeams: '8',
      approvalMode: 'MANUAL',
    }))
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">События</div>
          <h2 style={{ margin: '4px 0 0' }}>Матчи</h2>
        </div>
        <div className="actions-row">
          <div style={{ minWidth: 200 }}>
            <Select
              value={cityId}
              onChange={setCityId}
              placeholder="Все города"
              options={[{ value: '', label: 'Все города' }, ...(cities || []).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <Select
              value={stadiumId}
              onChange={setStadiumId}
              placeholder="Все стадионы"
              options={[{ value: '', label: 'Все стадионы' }, ...(availableStadiums || []).map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <Select
              value={filters.status || ''}
              onChange={(v) => setFilters({ status: v || undefined })}
              placeholder="Любой статус"
              options={[
                { value: '', label: 'Любой статус' },
                { value: 'DRAFT', label: 'Черновик' },
                { value: 'OPEN', label: 'Открыт' },
                { value: 'FULL', label: 'Заполнен' },
                { value: 'FINISHED', label: 'Завершён' },
                { value: 'CANCELLED', label: 'Отменён' },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <form onSubmit={handleSubmit} className="form-grid">
          <div>
            <div className="form-section-title">Стадион</div>
            <Select
              value={form.stadiumId}
              onChange={(v) => setForm({ ...form, stadiumId: v })}
              placeholder="Выберите"
              options={[{ value: '', label: 'Выберите' }, ...(availableStadiums || []).map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
          <div>
            <div className="form-section-title">Дата/время начала</div>
            <input
              className="datetime"
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>
          <div>
            <div className="form-section-title">Дата/время окончания</div>
            <input
              className="datetime"
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
          <div>
            <div className="form-section-title">Формат</div>
            <Select
              value={form.format}
              onChange={(v) => setForm({ ...form, format: v as Match['format'] })}
              options={[
                { value: 'FIVE_X_FIVE', label: '5x5' },
                { value: 'SEVEN_X_SEVEN', label: '7x7' },
                { value: 'ELEVEN_X_ELEVEN', label: '11x11' },
              ]}
            />
          </div>
          <div>
            <div className="form-section-title">Макс. команд</div>
            <input
              className="input"
              type="number"
              value={form.maxTeams}
              onChange={(e) => setForm({ ...form, maxTeams: e.target.value })}
            />
          </div>
          <div>
            <div className="form-section-title">Цена (в рублях)</div>
            <input
              className="input"
              type="number"
              step="0.01"
              value={form.priceRub}
              onChange={(e) => setForm({ ...form, priceRub: e.target.value })}
            />
          </div>
          <div>
            <div className="form-section-title">Валюта</div>
            <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Статус</div>
            <Select
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v as Match['status'] })}
              options={[
                { value: 'DRAFT', label: 'Черновик' },
                { value: 'OPEN', label: 'Открыт' },
                { value: 'FULL', label: 'Заполнен' },
                { value: 'FINISHED', label: 'Завершён' },
                { value: 'CANCELLED', label: 'Отменён' },
              ]}
            />
          </div>
          <div>
            <div className="form-section-title">Модерация заявок</div>
            <Select
              value={form.approvalMode}
              onChange={(v) =>
                setForm({ ...form, approvalMode: v as Match['approvalMode'] })
              }
              options={[
                { value: 'MANUAL', label: 'Ручная модерация' },
                {
                  value: 'AUTO_FIRST_COME',
                  label: 'Автопринятие первых заявок',
                },
              ]}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Описание</div>
            <textarea
              className="textarea"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="button" type="submit" disabled={createMatch.isPending || updateMatch.isPending}>
              {editingId ? 'Сохранить изменения' : 'Создать матч'}
            </button>
            {editingId && (
              <button
                className="button"
                type="button"
                style={{ background: '#6b7280', color: '#fff', marginLeft: 8 }}
                onClick={() => {
                  setEditingId(null)
                  setForm((f) => ({ ...f, description: '' }))
                }}
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="cards-grid" style={{ marginTop: 16 }}>
        {matches?.map((match: Match) => (
          <div key={match.id} className="match-card">
            <div className="actions-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="small-label">{match.stadium?.city?.name || '—'}</div>
                <div style={{ fontWeight: 700 }}>{match.stadium?.name}</div>
              </div>
              <div className="actions-row" style={{ gap: 8 }}>
                <div className="badge tag-muted">
                  <span className={`status-dot status-${match.status.toLowerCase()}`} />
                  {statusLabels[match.status]}
                </div>
                <div className="badge tag-muted">
                  {approvalModeLabels[match.approvalMode || 'MANUAL']}
                </div>
                <div className="table-actions">
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      setEditingId(match.id)
                      setForm({
                        stadiumId: match.stadiumId,
                        startTime: dayjs(match.startTime).format('YYYY-MM-DDTHH:mm'),
                        endTime: dayjs(match.endTime).format('YYYY-MM-DDTHH:mm'),
                        format: match.format,
                        maxTeams: String(match.maxTeams),
                        priceRub: ((match.priceCents || 0) / 100).toString(),
                        currency: match.currency || 'RUB',
                        status: match.status,
                        approvalMode: match.approvalMode || 'MANUAL',
                        description: match.description || '',
                      })
                    }}
                  >
                    Редактировать
                  </button>
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={() => deleteMatch.mutate(match.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
              <div className="actions-row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="small-label">Начало</div>
                  <div>{dayjs(match.startTime).format('DD.MM HH:mm')}</div>
                </div>
                <div>
                  <div className="small-label">Формат</div>
                  <div>{formatLabels[match.format]}</div>
                </div>
                <div className="text-right">
                  <div className="small-label">Команд</div>
                  <div>
                    {(match.registrations?.filter((r) => r.status === 'APPROVED').length ?? 0)}/{match.maxTeams}
                  </div>
                </div>
              </div>
            {match.priceCents ? (
              <div className="small-label">Цена: {(match.priceCents / 100).toFixed(2)} ₽</div>
            ) : (
              <div className="small-label">Бесплатно</div>
            )}
            {match.description && <div style={{ color: '#cdd8e5', fontSize: '0.93rem' }}>{match.description}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MatchesPage

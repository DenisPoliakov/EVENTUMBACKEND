import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useCities, useClubs, useDeleteMutation, usePostMutation, usePutMutation, useSports } from '../api/hooks'
import Select from '../components/Select'
import type { ClubSchedule, SportClub } from '../types'

const dayOptions = [
  { value: '', label: 'День не указан' },
  { value: '1', label: 'Понедельник' },
  { value: '2', label: 'Вторник' },
  { value: '3', label: 'Среда' },
  { value: '4', label: 'Четверг' },
  { value: '5', label: 'Пятница' },
  { value: '6', label: 'Суббота' },
  { value: '7', label: 'Воскресенье' },
]

const emptySchedule = (): ClubSchedule => ({
  title: '',
  dayOfWeek: null,
  startTime: '',
  endTime: '',
  ageGroup: '',
  coachName: '',
  note: '',
})

function ClubsPage() {
  const { data: sports } = useSports()
  const { data: cities } = useCities()
  const [filters, setFilters] = useState({ sportId: '', cityId: '', age: '' })
  const { data: clubs } = useClubs({
    sportId: filters.sportId || undefined,
    cityId: filters.cityId || undefined,
    age: filters.age || undefined,
  })
  const createClub = usePostMutation('/clubs', ['clubs'])
  const updateClub = usePutMutation((payload) => `/clubs/${payload.id}`, ['clubs'])
  const deleteClub = useDeleteMutation((id) => `/clubs/${id}`, ['clubs'])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    sportId: '',
    cityId: '',
    name: '',
    kind: '',
    address: '',
    description: '',
    latitude: '',
    longitude: '',
    imageUrl: '',
    yandexMapsUrl: '',
    minAge: '',
    maxAge: '',
    coaches: '',
    schedules: [emptySchedule()],
  })

  const sportOptions = useMemo(() => [{ value: '', label: 'Все виды спорта' }, ...(sports || []).map((s) => ({ value: s.id, label: s.name }))], [sports])
  const cityOptions = useMemo(() => [{ value: '', label: 'Все города' }, ...(cities || []).map((c) => ({ value: c.id, label: c.name }))], [cities])

  const reset = () => {
    setEditingId(null)
    setForm({
      sportId: '',
      cityId: '',
      name: '',
      kind: '',
      address: '',
      description: '',
      latitude: '',
      longitude: '',
      imageUrl: '',
      yandexMapsUrl: '',
      minAge: '',
      maxAge: '',
      coaches: '',
      schedules: [emptySchedule()],
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.sportId || !form.name.trim() || !form.address.trim()) return
    const payload = {
      ...form,
      latitude: form.latitude || undefined,
      longitude: form.longitude || undefined,
      minAge: form.minAge || undefined,
      maxAge: form.maxAge || undefined,
      cityId: form.cityId || undefined,
      coaches: form.coaches.split(',').map((item) => item.trim()).filter(Boolean),
      schedules: form.schedules.filter((item) => item.startTime && item.endTime),
    }
    if (editingId) updateClub.mutate({ id: editingId, ...payload })
    else createClub.mutate(payload)
    reset()
  }

  const setSchedule = (index: number, patch: Partial<ClubSchedule>) => {
    setForm((prev) => ({
      ...prev,
      schedules: prev.schedules.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Экосистема</div>
          <h2 style={{ margin: '4px 0 0' }}>Клубы и залы</h2>
        </div>
        <div className="actions-row">
          <div style={{ minWidth: 190 }}>
            <Select value={filters.sportId} onChange={(sportId) => setFilters({ ...filters, sportId })} options={sportOptions} />
          </div>
          <div style={{ minWidth: 190 }}>
            <Select value={filters.cityId} onChange={(cityId) => setFilters({ ...filters, cityId })} options={cityOptions} />
          </div>
          <input className="input" style={{ width: 110 }} placeholder="Возраст" value={filters.age} onChange={(e) => setFilters({ ...filters, age: e.target.value })} />
        </div>
      </div>

      <div className="panel">
        <form className="form-grid" onSubmit={submit}>
          <div>
            <div className="form-section-title">Вид спорта</div>
            <Select value={form.sportId} onChange={(sportId) => setForm({ ...form, sportId })} options={[{ value: '', label: 'Выберите' }, ...(sports || []).map((s) => ({ value: s.id, label: s.name }))]} />
          </div>
          <div>
            <div className="form-section-title">Город</div>
            <Select value={form.cityId} onChange={(cityId) => setForm({ ...form, cityId })} options={[{ value: '', label: 'Не указан' }, ...(cities || []).map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <div>
            <div className="form-section-title">Название</div>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Тип</div>
            <input className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} placeholder="Стадион, зал, клуб" />
          </div>
          <div>
            <div className="form-section-title">Адрес</div>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Ссылка Яндекс.Карт</div>
            <input className="input" value={form.yandexMapsUrl} onChange={(e) => setForm({ ...form, yandexMapsUrl: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Возраст от</div>
            <input className="input" type="number" value={form.minAge} onChange={(e) => setForm({ ...form, minAge: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Возраст до</div>
            <input className="input" type="number" value={form.maxAge} onChange={(e) => setForm({ ...form, maxAge: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Широта</div>
            <input className="input" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Долгота</div>
            <input className="input" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Тренеры через запятую</div>
            <input className="input" value={form.coaches} onChange={(e) => setForm({ ...form, coaches: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Описание</div>
            <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Расписание тренировок</div>
            {form.schedules.map((schedule, index) => (
              <div key={index} className="actions-row" style={{ marginBottom: 8, alignItems: 'stretch' }}>
                <Select value={schedule.dayOfWeek?.toString() || ''} onChange={(day) => setSchedule(index, { dayOfWeek: day ? Number(day) : null })} options={dayOptions} />
                <input className="input" placeholder="Начало 18:00" value={schedule.startTime} onChange={(e) => setSchedule(index, { startTime: e.target.value })} />
                <input className="input" placeholder="Конец 19:30" value={schedule.endTime} onChange={(e) => setSchedule(index, { endTime: e.target.value })} />
                <input className="input" placeholder="Тренер" value={schedule.coachName || ''} onChange={(e) => setSchedule(index, { coachName: e.target.value })} />
                <button className="button button-danger" type="button" onClick={() => setForm((prev) => ({ ...prev, schedules: prev.schedules.filter((_, i) => i !== index) }))}>
                  —
                </button>
              </div>
            ))}
            <button className="button button-muted" type="button" onClick={() => setForm((prev) => ({ ...prev, schedules: [...prev.schedules, emptySchedule()] }))}>
              Добавить тренировку
            </button>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="button" type="submit">{editingId ? 'Сохранить' : 'Добавить клуб'}</button>
            {editingId && <button className="button button-muted" type="button" onClick={reset}>Отмена</button>}
          </div>
        </form>
      </div>

      <div className="cards-grid" style={{ marginTop: 16 }}>
        {clubs?.map((club: SportClub) => (
          <div key={club.id} className="match-card">
            <div className="small-label">{club.sport?.name || '—'} • {club.city || 'город не указан'}</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{club.name}</div>
            <div>{club.address}</div>
            {club.coaches?.length ? <div className="small-label">Тренеры: {club.coaches.join(', ')}</div> : null}
            {club.schedules?.length ? <div className="small-label">Тренировок: {club.schedules.length}</div> : null}
            <div className="table-actions">
              <button
                className="button"
                type="button"
                onClick={() => {
                  setEditingId(club.id)
                  setForm({
                    sportId: club.sportId,
                    cityId: club.cityId || '',
                    name: club.name,
                    kind: club.kind || '',
                    address: club.address,
                    description: club.description || '',
                    latitude: club.latitude?.toString() || '',
                    longitude: club.longitude?.toString() || '',
                    imageUrl: club.imageUrl || '',
                    yandexMapsUrl: club.yandexMapsUrl || '',
                    minAge: club.minAge?.toString() || '',
                    maxAge: club.maxAge?.toString() || '',
                    coaches: club.coaches?.join(', ') || '',
                    schedules: club.schedules?.length ? club.schedules : [emptySchedule()],
                  })
                }}
              >
                Редактировать
              </button>
              <button className="button button-danger" type="button" onClick={() => deleteClub.mutate(club.id)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ClubsPage

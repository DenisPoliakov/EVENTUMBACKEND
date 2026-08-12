import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  useClubs,
  useDeleteMutation,
  usePostMutation,
  usePutMutation,
  useSports,
  useSubscriptionPlans,
} from '../api/hooks'
import Select from '../components/Select'
import type { MembershipPlan } from '../types'

function SubscriptionPlansPage() {
  const { data: sports } = useSports()
  const boxingSportId = sports?.find((sport) => sport.code === 'BOXING')?.id || ''
  const [filters, setFilters] = useState({ clubId: '' })
  const { data: clubs } = useClubs({ sportCode: 'BOXING' })
  const { data: plans } = useSubscriptionPlans({
    sportId: boxingSportId || undefined,
    clubId: filters.clubId || undefined,
  })
  const createPlan = usePostMutation('/subscription-plans', ['subscription-plans'])
  const updatePlan = usePutMutation((payload) => `/subscription-plans/${payload.id}`, ['subscription-plans'])
  const deletePlan = useDeleteMutation((id) => `/subscription-plans/${id}`, ['subscription-plans'])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    sportId: '',
    clubId: '',
    tier: '',
    title: '',
    description: '',
    priceRub: '',
    currency: 'RUB',
    durationDays: '30',
    isActive: 'true',
  })

  const clubOptions = useMemo(() => [{ value: '', label: 'Все клубы' }, ...(clubs || []).map((c) => ({ value: c.id, label: c.name }))], [clubs])

  const reset = () => {
    setEditingId(null)
    setForm({
      sportId: boxingSportId,
      clubId: '',
      tier: '',
      title: '',
      description: '',
      priceRub: '',
      currency: 'RUB',
      durationDays: '30',
      isActive: 'true',
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!boxingSportId || !form.title.trim()) return
    const payload = {
      sportId: boxingSportId,
      clubId: form.clubId || undefined,
      tier: form.tier || undefined,
      title: form.title,
      description: form.description,
      priceCents: Math.round((parseFloat(form.priceRub || '0') || 0) * 100),
      currency: form.currency,
      durationDays: Number(form.durationDays) || 30,
      isActive: form.isActive === 'true',
    }
    if (editingId) updatePlan.mutate({ id: editingId, ...payload })
    else createPlan.mutate(payload)
    reset()
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">EVENTUM CLUBS</div>
          <h2 style={{ margin: '4px 0 0' }}>Абонементы</h2>
        </div>
        <div className="actions-row">
          <div style={{ minWidth: 220 }}>
            <Select value={filters.clubId} onChange={(clubId) => setFilters({ ...filters, clubId })} options={clubOptions} />
          </div>
        </div>
      </div>

      <div className="panel">
        <form className="form-grid" onSubmit={submit}>
          <div>
            <div className="form-section-title">Сервис</div>
            <input className="input" value="EVENTUM CLUBS · Бокс" disabled />
          </div>
          <div>
            <div className="form-section-title">Клуб/зал</div>
            <Select value={form.clubId} onChange={(clubId) => setForm({ ...form, clubId })} options={[{ value: '', label: 'Для всех клубов' }, ...(clubs || []).map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <div>
            <div className="form-section-title">Название</div>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Tier</div>
            <Select
              value={form.tier}
              onChange={(tier) => setForm({ ...form, tier })}
              options={[
                { value: '', label: 'Без tier' },
                { value: 'BRONZE', label: 'Bronze' },
                { value: 'SILVER', label: 'Silver' },
                { value: 'GOLD', label: 'Gold' },
              ]}
            />
          </div>
          <div>
            <div className="form-section-title">Цена, ₽</div>
            <input className="input" type="number" value={form.priceRub} onChange={(e) => setForm({ ...form, priceRub: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Дней действия</div>
            <input className="input" type="number" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Активен</div>
            <Select value={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} options={[{ value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }]} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Описание</div>
            <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="button" type="submit">{editingId ? 'Сохранить' : 'Добавить абонемент'}</button>
            {editingId && <button className="button button-muted" type="button" onClick={reset}>Отмена</button>}
          </div>
        </form>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Абонемент</th>
              <th>Спорт</th>
              <th>Клуб</th>
              <th>Tier</th>
              <th>Цена</th>
              <th>Дней</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plans?.map((plan: MembershipPlan) => (
              <tr key={plan.id}>
                <td>{plan.title}</td>
                <td>{plan.sport?.name || '—'}</td>
                <td>{plan.club?.name || 'Все клубы'}</td>
                <td>{plan.tier || '—'}</td>
                <td>{(plan.priceCents / 100).toFixed(2)} {plan.currency}</td>
                <td>{plan.durationDays}</td>
                <td>{plan.isActive ? 'Активен' : 'Выключен'}</td>
                <td className="text-right">
                  <div className="table-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        setEditingId(plan.id)
                        setForm({
                          sportId: plan.sportId,
                          clubId: plan.clubId || '',
                          tier: plan.tier || '',
                          title: plan.title,
                          description: plan.description || '',
                          priceRub: (plan.priceCents / 100).toString(),
                          currency: plan.currency,
                          durationDays: plan.durationDays.toString(),
                          isActive: plan.isActive ? 'true' : 'false',
                        })
                      }}
                    >
                      Редактировать
                    </button>
                    <button className="button button-danger" type="button" onClick={() => deletePlan.mutate(plan.id)}>
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

export default SubscriptionPlansPage

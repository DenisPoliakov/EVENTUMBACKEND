import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '../api/client'
import { useClubs, usePushCampaigns, usePushTemplates, useUsers } from '../api/hooks'
import type { PushTargetSegment } from '../types'

const emptyForm = {
  name: '',
  title: '',
  body: '',
  imageUrl: '',
  targetSegment: 'ALL_USERS' as PushTargetSegment,
  favoriteClubId: '',
  selectedUserIds: [] as string[],
}

function PushCampaignsPage() {
  const qc = useQueryClient()
  const campaigns = usePushCampaigns()
  const templates = usePushTemplates()
  const users = useUsers({})
  const clubs = useClubs({})
  const [form, setForm] = useState(emptyForm)
  const [preview, setPreview] = useState<{ recipientCount: number; canSend: boolean } | null>(null)
  const [error, setError] = useState('')

  const createCampaign = useMutation({
    mutationFn: async () => (await api.post('/push-campaigns', form)).data,
    onSuccess: async (campaign) => {
      await qc.invalidateQueries({ queryKey: ['push-campaigns'] })
      const result = (await api.get(`/push-campaigns/${campaign.id}/preview`)).data
      setPreview(result)
      setForm(emptyForm)
      setError('')
    },
    onError: () => setError('Не удалось создать кампанию. Проверьте обязательные поля.'),
  })
  const sendCampaign = useMutation({
    mutationFn: async (id: string) => (await api.post(`/push-campaigns/${id}/send`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-campaigns'] }),
  })
  const createTemplate = useMutation({
    mutationFn: async () => api.post('/push-campaigns/templates', {
      name: form.name,
      title: form.title,
      body: form.body,
      imageUrl: form.imageUrl,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-templates'] }),
  })

  const toggleUser = (id: string) => {
    setForm((current) => ({
      ...current,
      selectedUserIds: current.selectedUserIds.includes(id)
        ? current.selectedUserIds.filter((item) => item !== id)
        : [...current.selectedUserIds, id],
    }))
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">FCM + уведомления в приложении</div>
          <h2 style={{ margin: '4px 0 0' }}>Push-кампании и шаблоны</h2>
        </div>
      </div>
      <div className="panel">
        <h3>Новая кампания</h3>
        <div className="form-grid">
          <input className="input" placeholder="Название кампании" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <select className="select" value="" onChange={(event) => {
            const template = templates.data?.find((item) => item.id === event.target.value)
            if (template) setForm({ ...form, name: template.name, title: template.title, body: template.body, imageUrl: template.imageUrl || '' })
          }}>
            <option value="">Заполнить из шаблона…</option>
            {templates.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input className="input" placeholder="Заголовок push" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <input className="input" placeholder="URL изображения (необязательно)" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
          <select className="select" value={form.targetSegment} onChange={(event) => setForm({ ...form, targetSegment: event.target.value as PushTargetSegment })}>
            <option value="ALL_USERS">Все незаблокированные пользователи</option>
            <option value="SELECTED_USERS">Выбранные пользователи</option>
            <option value="FAVORITE_CLUB">Добавившие клуб в избранное</option>
          </select>
          {form.targetSegment === 'FAVORITE_CLUB' && (
            <select className="select" value={form.favoriteClubId} onChange={(event) => setForm({ ...form, favoriteClubId: event.target.value })}>
              <option value="">Выберите клуб</option>
              {clubs.data?.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
          )}
        </div>
        <textarea className="textarea" rows={4} placeholder="Текст сообщения" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} style={{ marginTop: 12 }} />
        {form.targetSegment === 'SELECTED_USERS' && (
          <div className="panel" style={{ marginTop: 12, maxHeight: 220, overflow: 'auto' }}>
            {users.data?.map((user) => (
              <label key={user.id} style={{ display: 'block', marginBottom: 8 }}>
                <input type="checkbox" checked={form.selectedUserIds.includes(user.id)} onChange={() => toggleUser(user.id)} />{' '}
                {user.name || user.username || user.email} <span className="small-label">{user.email}</span>
              </label>
            ))}
          </div>
        )}
        {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
        {preview && <p className="small-label">Последний предпросмотр: {preview.recipientCount} получателей; отправка {preview.canSend ? 'разрешена' : 'заблокирована лимитом'}.</p>}
        <div className="actions-row" style={{ marginTop: 12 }}>
          <button className="button" onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending}>Создать и проверить аудиторию</button>
          <button className="button button-muted" onClick={() => createTemplate.mutate()} disabled={createTemplate.isPending}>Сохранить шаблон</button>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Кампании</h3>
        <table className="table">
          <thead><tr><th>Кампания</th><th>Сегмент</th><th>Статус</th><th>In-app / Push / Ошибки / Пропуски</th><th /></tr></thead>
          <tbody>
            {campaigns.data?.map((campaign) => (
              <tr key={campaign.id}>
                <td>{campaign.name}<br /><span className="small-label">{campaign.title}</span></td>
                <td>{campaign.targetSegment}{campaign.favoriteClub ? ` · ${campaign.favoriteClub.name}` : ''}</td>
                <td>{campaign.status}{campaign.lastError && <><br /><span className="small-label">{campaign.lastError}</span></>}</td>
                <td>{campaign.inAppCreatedCount} / {campaign.pushSentCount} / {campaign.pushFailedCount} / {campaign.pushSkippedCount}</td>
                <td><button className="button" disabled={campaign.status === 'SENT' || campaign.status === 'SENDING' || sendCampaign.isPending} onClick={() => sendCampaign.mutate(campaign.id)}>Отправить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PushCampaignsPage

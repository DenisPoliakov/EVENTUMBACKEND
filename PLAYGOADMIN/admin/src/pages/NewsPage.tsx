import { useState } from 'react'
import type { FormEvent } from 'react'
import dayjs from 'dayjs'
import { useDeleteMutation, useNews, usePostMutation, usePutMutation } from '../api/hooks'
import { api, uploadFile } from '../api/client'
import type { NewsItem } from '../types'

function NewsPage() {
  const { data: news } = useNews()
  const createNews = usePostMutation('/news', ['news'])
  const updateNews = usePutMutation((payload) => `/news/${payload.id}`, ['news'])
  const deleteNews = useDeleteMutation((id) => `/news/${id}`, ['news'])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    body: '',
    imageUrl: '',
    publishedAt: '',
  })

  const resetForm = () => {
    setEditingId(null)
    setForm({
      title: '',
      body: '',
      imageUrl: '',
      publishedAt: '',
    })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return

    const payload = {
      ...form,
      publishedAt: form.publishedAt || undefined,
    }

    if (editingId) {
      updateNews.mutate({ id: editingId, ...payload })
    } else {
      createNews.mutate(payload)
    }
    resetForm()
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Контент</div>
          <h2 style={{ margin: '4px 0 0' }}>Новости</h2>
        </div>
      </div>

      <div className="panel">
        <form onSubmit={handleSubmit} className="form-grid">
          <div>
            <div className="form-section-title">Заголовок</div>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <div className="form-section-title">Дата публикации</div>
            <input
              className="datetime"
              type="datetime-local"
              value={form.publishedAt}
              onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Текст новости</div>
            <textarea
              className="textarea"
              rows={4}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Изображение</div>
            <input
              className="input"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://... или /uploads/..."
            />
            <input
              className="input"
              type="file"
              accept="image/*"
              style={{ marginTop: 6 }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const relativeUrl = await uploadFile(file)
                const base = api.defaults.baseURL?.replace(/\/api(?:\/admin)?$/, '') || window.location.origin
                const fullUrl = new URL(relativeUrl, base).toString()
                setForm((prev) => ({ ...prev, imageUrl: fullUrl }))
              }}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="button" type="submit" disabled={createNews.isPending || updateNews.isPending}>
              {editingId ? 'Сохранить изменения' : 'Опубликовать новость'}
            </button>
            {editingId && (
              <button
                className="button"
                type="button"
                style={{ background: '#6b7280', color: '#fff', marginLeft: 8 }}
                onClick={resetForm}
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="cards-grid" style={{ marginTop: 16 }}>
        {news?.map((item: NewsItem) => (
          <div key={item.id} className="match-card">
            <div className="actions-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="small-label">
                  {item.type === 'MANUAL'
                    ? 'Ручная новость'
                    : item.type === 'STADIUM_CREATED'
                      ? 'Автоновость: стадион'
                      : 'Автоновость: матч'}
                </div>
                <div style={{ fontWeight: 700 }}>{item.title}</div>
              </div>
              <div className="table-actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setEditingId(item.id)
                    setForm({
                      title: item.title,
                      body: item.body,
                      imageUrl: item.imageUrl || '',
                      publishedAt: item.publishedAt ? dayjs(item.publishedAt).format('YYYY-MM-DDTHH:mm') : '',
                    })
                  }}
                >
                  Редактировать
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => deleteNews.mutate(item.id)}
                >
                  Удалить
                </button>
              </div>
            </div>
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title}
                style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 14, marginTop: 12 }}
              />
            ) : null}
            <div style={{ marginTop: 12, color: '#cdd8e5', whiteSpace: 'pre-wrap' }}>{item.body}</div>
            <div className="small-label" style={{ marginTop: 12 }}>
              {item.publishedAt ? dayjs(item.publishedAt).format('DD.MM.YYYY HH:mm') : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NewsPage

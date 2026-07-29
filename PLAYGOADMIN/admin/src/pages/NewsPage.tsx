import { useState } from 'react'
import type { FormEvent } from 'react'
import dayjs from 'dayjs'
import {
  useClubs,
  useDeleteMutation,
  useNews,
  usePostMutation,
  usePutMutation,
  useUploadNewsImage,
} from '../api/hooks'
import { api } from '../api/client'
import Select from '../components/Select'
import type { NewsItem } from '../types'

const mediaUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url
  const base =
    api.defaults.baseURL?.replace(/\/api\/admin\/?$/, '') ||
    window.location.origin
  return new URL(url, `${base}/`).toString()
}

function NewsPage() {
  const { data: news } = useNews()
  const { data: clubs } = useClubs({})
  const createNews = usePostMutation('/news', ['news'])
  const updateNews = usePutMutation((payload) => `/news/${payload.id}`, ['news'])
  const deleteNews = useDeleteMutation((id) => `/news/${id}`, ['news'])
  const uploadNewsImage = useUploadNewsImage()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    title: '',
    body: '',
    imageUrl: '',
    type: 'news',
    clubId: '',
    publishedAt: '',
  })

  const resetForm = () => {
    setEditingId(null)
    setImageFile(null)
    setForm({
      title: '',
      body: '',
      imageUrl: '',
      type: 'news',
      clubId: '',
      publishedAt: '',
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return

    const payload = {
      ...form,
      clubId: form.clubId || null,
      publishedAt: form.publishedAt || undefined,
    }

    let newsId: string
    if (editingId) {
      await updateNews.mutateAsync({ id: editingId, ...payload })
      newsId = editingId
    } else {
      const created = (await createNews.mutateAsync(payload)) as NewsItem
      newsId = created.id
    }
    if (imageFile) {
      await uploadNewsImage.mutateAsync({ id: newsId, file: imageFile })
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
          <div>
            <div className="form-section-title">Тип</div>
            <Select
              fullWidth
              value={form.type}
              onChange={(type) => setForm({ ...form, type })}
              options={[
                { value: 'news', label: 'Новость' },
                { value: 'sponsored', label: 'Спонсорская' },
              ]}
            />
          </div>
          <div>
            <div className="form-section-title">Клуб</div>
            <Select
              fullWidth
              value={form.clubId}
              onChange={(clubId) => setForm({ ...form, clubId })}
              options={[
                { value: '', label: 'Без привязки к клубу' },
                ...(clubs || []).map((club) => ({
                  value: club.id,
                  label: club.name,
                })),
              ]}
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
              readOnly
              placeholder="Изображение не загружено"
            />
            <input
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ marginTop: 6 }}
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="button"
              type="submit"
              disabled={
                createNews.isPending ||
                updateNews.isPending ||
                uploadNewsImage.isPending
              }
            >
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
                  {item.type === 'news'
                    ? 'Новость'
                    : item.type === 'sponsored'
                      ? 'Спонсорская новость'
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
                      type:
                        item.type === 'sponsored' ? 'sponsored' : 'news',
                      clubId: item.clubId || '',
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
                src={mediaUrl(item.imageUrl)}
                alt={item.title}
                style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 14, marginTop: 12 }}
              />
            ) : null}
            <div style={{ marginTop: 12, color: '#cdd8e5', whiteSpace: 'pre-wrap' }}>{item.body}</div>
            <div className="small-label" style={{ marginTop: 12 }}>
              {item.publishedAt ? dayjs(item.publishedAt).format('DD.MM.YYYY HH:mm') : ''}
            </div>
            <div className="small-label" style={{ marginTop: 6 }}>
              {item.club ? `Клуб: ${item.club.name} · ` : ''}
              Просмотры: {item.viewCount} · Уник. пользователи: {item.uniqueViewerCount}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NewsPage

import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import dayjs from 'dayjs'

import {
  useDeleteMutation,
  usePostMutation,
  usePutMutation,
  useUploadWellnessStoryCover,
  useWellnessStories,
} from '../api/hooks'
import { api } from '../api/client'
import Select from '../components/Select'
import type { WellnessStory, WellnessStoryCategory } from '../types'

const categoryOptions: Array<{
  value: WellnessStoryCategory
  label: string
}> = [
  { value: 'nutrition', label: 'Питание' },
  { value: 'warmup', label: 'Разминка' },
  { value: 'routine', label: 'Режим' },
  { value: 'workouts', label: 'Тренировки' },
  { value: 'balance', label: 'Баланс' },
]

const categoryLabels = Object.fromEntries(
  categoryOptions.map((option) => [option.value, option.label]),
) as Record<WellnessStoryCategory, string>

const emptyForm = () => ({
  slug: '',
  title: '',
  body: '',
  category: 'nutrition' as WellnessStoryCategory,
  coverImageUrl: '',
  readMinutes: '3',
  sortOrder: '0',
  publishedAt: '',
  isActive: 'true',
})

const toAbsoluteMediaUrl = (url: string) => {
  if (!url) return ''
  const base =
    api.defaults.baseURL?.replace(/\/api(?:\/admin)?$/, '') ||
    window.location.origin
  return new URL(url, base).toString()
}

function WellnessStoriesPage() {
  const { data: stories, isLoading } = useWellnessStories()
  const createStory = usePostMutation('/wellness-stories', [
    'wellness-stories',
  ])
  const updateStory = usePutMutation(
    (payload) => `/wellness-stories/${payload.id}`,
    ['wellness-stories'],
  )
  const deleteStory = useDeleteMutation(
    (id) => `/wellness-stories/${id}`,
    ['wellness-stories'],
  )
  const uploadCover = useUploadWellnessStoryCover()
  const importStories = usePostMutation('/wellness-stories/import', [
    'wellness-stories',
  ])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [importJson, setImportJson] = useState('')
  const [importResult, setImportResult] = useState('')
  const [error, setError] = useState('')

  const selectedCoverPreview = useMemo(
    () => (coverFile ? URL.createObjectURL(coverFile) : ''),
    [coverFile],
  )

  useEffect(
    () => () => {
      if (selectedCoverPreview) URL.revokeObjectURL(selectedCoverPreview)
    },
    [selectedCoverPreview],
  )

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm())
    setCoverFile(null)
    setError('')
  }

  const handleCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCoverFile(event.target.files?.[0] || null)
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) setImportJson(await file.text())
  }

  const handleImport = async () => {
    setError('')
    setImportResult('')
    try {
      const parsed: unknown = JSON.parse(importJson)
      const payload = Array.isArray(parsed) ? { stories: parsed } : parsed
      const result = (await importStories.mutateAsync(payload)) as {
        created: number
        updated: number
      }
      setImportResult(
        `Импорт завершён: создано ${result.created}, обновлено ${result.updated}`,
      )
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Не удалось импортировать JSON',
      )
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!form.title.trim() || !form.body.trim()) {
      setError('Заполните заголовок и текст истории')
      return
    }

    const payload = {
      slug: form.slug.trim() || null,
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      coverImageUrl: form.coverImageUrl || null,
      readMinutes: Number(form.readMinutes),
      sortOrder: Number(form.sortOrder),
      locale: 'ru',
      publishedAt: form.publishedAt || undefined,
      isActive: form.isActive === 'true',
    }

    try {
      let saved: WellnessStory
      if (editingId) {
        saved = (await updateStory.mutateAsync({
          id: editingId,
          ...payload,
        })) as WellnessStory
      } else {
        saved = (await createStory.mutateAsync(payload)) as WellnessStory
        if (coverFile) setEditingId(saved.id)
      }

      if (coverFile) {
        await uploadCover.mutateAsync({ id: saved.id, file: coverFile })
      }
      resetForm()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Не удалось сохранить Wellness-историю',
      )
    }
  }

  const startEditing = (story: WellnessStory) => {
    setEditingId(story.id)
    setCoverFile(null)
    setError('')
    setForm({
      slug: story.slug || '',
      title: story.title,
      body: story.body,
      category: story.category,
      coverImageUrl: story.coverImageUrl || '',
      readMinutes: String(story.readMinutes),
      sortOrder: String(story.sortOrder),
      publishedAt: story.publishedAt
        ? dayjs(story.publishedAt).format('YYYY-MM-DDTHH:mm')
        : '',
      isActive: story.isActive ? 'true' : 'false',
    })
  }

  const handleDelete = async (story: WellnessStory) => {
    if (!window.confirm(`Удалить историю «${story.title}»?`)) return
    try {
      await deleteStory.mutateAsync(story.id)
      if (editingId === story.id) resetForm()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Не удалось удалить Wellness-историю',
      )
    }
  }

  const previewUrl =
    selectedCoverPreview || toAbsoluteMediaUrl(form.coverImageUrl)
  const isSaving =
    createStory.isPending || updateStory.isPending || uploadCover.isPending

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Контент</div>
          <h2 style={{ margin: '4px 0 0' }}>Wellness-истории</h2>
        </div>
      </div>

      <div className="panel">
        <div className="form-section-title">Импорт русских историй по slug</div>
        <p style={{ marginTop: 6 }}>
          Вставьте JSON-массив историй или объект <code>{`{"stories": [...]}`}</code>.
          Все записи проверяются до транзакционного импорта.
        </p>
        <textarea
          className="textarea"
          rows={6}
          value={importJson}
          placeholder='[{"slug":"recovery-basics","title":"...","body":"...","category":"routine"}]'
          onChange={(event) => setImportJson(event.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="input"
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
          />
          <button
            className="button"
            type="button"
            disabled={!importJson.trim() || importStories.isPending}
            onClick={handleImport}
          >
            {importStories.isPending ? 'Импорт...' : 'Импортировать'}
          </button>
        </div>
        {importResult ? (
          <div style={{ marginTop: 10, color: '#86efac' }}>{importResult}</div>
        ) : null}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div>
            <div className="form-section-title">Slug (опционально)</div>
            <input
              className="input"
              value={form.slug}
              placeholder="recovery-basics"
              onChange={(event) =>
                setForm({ ...form, slug: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Заголовок</div>
            <input
              className="input"
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Категория</div>
            <Select
              value={form.category}
              onChange={(category) =>
                setForm({
                  ...form,
                  category: category as WellnessStoryCategory,
                })
              }
              options={categoryOptions}
              fullWidth
            />
          </div>
          <div>
            <div className="form-section-title">Время чтения, мин.</div>
            <input
              className="input"
              type="number"
              min={1}
              max={120}
              value={form.readMinutes}
              onChange={(event) =>
                setForm({ ...form, readMinutes: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Порядок</div>
            <input
              className="input"
              type="number"
              value={form.sortOrder}
              onChange={(event) =>
                setForm({ ...form, sortOrder: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Дата публикации</div>
            <input
              className="datetime"
              type="datetime-local"
              value={form.publishedAt}
              onChange={(event) =>
                setForm({ ...form, publishedAt: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Активна</div>
            <Select
              value={form.isActive}
              onChange={(isActive) => setForm({ ...form, isActive })}
              options={[
                { value: 'true', label: 'Да' },
                { value: 'false', label: 'Нет' },
              ]}
              fullWidth
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Текст истории</div>
            <textarea
              className="textarea"
              rows={7}
              value={form.body}
              onChange={(event) =>
                setForm({ ...form, body: event.target.value })
              }
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Обложка</div>
            <input
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleCoverChange}
            />
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Предпросмотр обложки"
                style={{
                  width: 240,
                  height: 140,
                  objectFit: 'cover',
                  borderRadius: 12,
                  marginTop: 10,
                }}
              />
            ) : null}
          </div>
          {error ? (
            <div
              style={{
                gridColumn: '1 / -1',
                color: '#fca5a5',
              }}
            >
              {error}
            </div>
          ) : null}
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            <button className="button" type="submit" disabled={isSaving}>
              {isSaving
                ? 'Сохранение...'
                : editingId
                  ? 'Сохранить изменения'
                  : 'Добавить историю'}
            </button>
            {editingId ? (
              <button
                className="button button-muted"
                type="button"
                onClick={resetForm}
              >
                Отмена
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>История</th>
              <th>Slug</th>
              <th>Категория</th>
              <th>Статус</th>
              <th>Порядок</th>
              <th>Дата</th>
              <th>Просмотрели (уник.)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {stories?.map((story) => (
              <tr key={story.id}>
                <td>{story.title}</td>
                <td>{story.slug || '—'}</td>
                <td>{categoryLabels[story.category]}</td>
                <td>{story.isActive ? 'Активна' : 'Скрыта'}</td>
                <td>{story.sortOrder}</td>
                <td>
                  {dayjs(story.publishedAt).format('DD.MM.YYYY HH:mm')}
                </td>
                <td>{story.uniqueViewerCount}</td>
                <td className="text-right">
                  <div className="table-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => startEditing(story)}
                    >
                      Редактировать
                    </button>
                    <button
                      className="button button-danger"
                      type="button"
                      onClick={() => handleDelete(story)}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && stories?.length === 0 ? (
              <tr>
                <td colSpan={8}>Историй пока нет</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default WellnessStoriesPage

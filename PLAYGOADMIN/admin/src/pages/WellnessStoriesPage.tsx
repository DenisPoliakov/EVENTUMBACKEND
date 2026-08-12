import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import dayjs from 'dayjs'

import {
  useClubs,
  useDeleteMutation,
  usePostMutation,
  usePutMutation,
  useUploadWellnessStoryCover,
  useWellnessStories,
} from '../api/hooks'
import { api } from '../api/client'
import Select from '../components/Select'
import { slugify } from '../lib/slugify'
import type { WellnessStory, WellnessStoryCategory } from '../types'

const categoryOptions: Array<{
  value: WellnessStoryCategory
  label: string
}> = [
  { value: 'nutrition', label: 'Питание' },
  { value: 'warmup', label: 'Разминка' },
  { value: 'routine', label: 'Режим дня' },
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
  publishedAt: dayjs().format('YYYY-MM-DDTHH:mm'),
  isActive: 'true',
  authorClubId: '',
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
  const { data: clubs } = useClubs({})
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
  const [slugTouched, setSlugTouched] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showImport, setShowImport] = useState(false)
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
    setSlugTouched(false)
    setCoverFile(null)
    setError('')
  }

  const handleTitleChange = (title: string) => {
    setForm((current) => ({
      ...current,
      title,
      slug:
        !editingId && !slugTouched
          ? slugify(title, 'story')
          : current.slug,
    }))
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
        `Готово: добавлено ${result.created}, обновлено ${result.updated}`,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Не удалось импортировать файл',
      )
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!form.title.trim() || !form.body.trim()) {
      setError('Нужны заголовок и текст истории')
      return
    }

    const payload = {
      slug: form.slug.trim() || slugify(form.title, 'story'),
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      coverImageUrl: form.coverImageUrl || null,
      readMinutes: Number(form.readMinutes) || 3,
      sortOrder: Number(form.sortOrder) || 0,
      locale: 'ru',
      publishedAt: form.publishedAt || undefined,
      isActive: form.isActive === 'true',
      authorClubId: form.authorClubId || null,
      authorType: form.authorClubId ? 'club' : 'platform',
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
          : 'Не удалось сохранить историю',
      )
    }
  }

  const startEditing = (story: WellnessStory) => {
    setEditingId(story.id)
    setCoverFile(null)
    setSlugTouched(true)
    setShowAdvanced(true)
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
      authorClubId: story.authorClubId || '',
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
          : 'Не удалось удалить историю',
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
          <div className="small-label">EVENTUM CLUBS</div>
          <h2 style={{ margin: '4px 0 0' }}>Истории для приложения</h2>
          <p className="page-intro">
            Это короткие материалы во вкладке Wellness: заголовок, текст и
            картинка. Сначала заполните обычные поля — техническое можно не
            трогать.
          </p>
        </div>
        <button
          className="button button-muted"
          type="button"
          onClick={() => setShowImport((value) => !value)}
        >
          {showImport ? 'Скрыть импорт' : 'Массовый импорт'}
        </button>
      </div>

      {showImport ? (
        <div className="panel">
          <div className="form-section-title">Массовый импорт</div>
          <p className="field-hint">
            Для разработчика или контент-менеджера с готовым JSON-файлом.
            Обычному редактору это не нужно.
          </p>
          <textarea
            className="textarea"
            rows={5}
            value={importJson}
            placeholder="Вставьте JSON или выберите файл ниже"
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
      ) : null}

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="form-section-title">
          {editingId ? 'Редактирование истории' : 'Новая история'}
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Заголовок</div>
            <input
              className="input"
              value={form.title}
              placeholder="Например: Как восстановиться после тренировки"
              onChange={(event) => handleTitleChange(event.target.value)}
            />
          </div>
          <div>
            <div className="form-section-title">Тема</div>
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
            <p className="field-hint">По теме история попадёт в нужный раздел.</p>
          </div>
          <div>
            <div className="form-section-title">Сколько минут читать</div>
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
            <div className="form-section-title">Показывать в приложении</div>
            <Select
              value={form.isActive}
              onChange={(isActive) => setForm({ ...form, isActive })}
              options={[
                { value: 'true', label: 'Да, опубликовать' },
                { value: 'false', label: 'Нет, скрыть' },
              ]}
              fullWidth
            />
          </div>
          <div>
            <div className="form-section-title">От имени клуба</div>
            <Select
              fullWidth
              value={form.authorClubId}
              onChange={(authorClubId) => setForm({ ...form, authorClubId })}
              options={[
                { value: '', label: 'Платформа Eventum' },
                ...(clubs || []).map((club) => ({
                  value: club.id,
                  label: club.name,
                })),
              ]}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Текст</div>
            <textarea
              className="textarea"
              rows={8}
              value={form.body}
              placeholder="Напишите историю простым языком — как совет для пользователя."
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
            <p className="field-hint">
              Лучше горизонтальная картинка. Форматы: JPG, PNG, WebP или GIF до
              5 МБ.
            </p>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Предпросмотр обложки"
                className="content-card-media"
                style={{
                  width: 280,
                  borderRadius: 12,
                  marginTop: 10,
                }}
              />
            ) : null}
          </div>

          <div className="advanced-block">
            <button
              className="advanced-toggle"
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
            >
              {showAdvanced
                ? 'Скрыть дополнительные настройки'
                : 'Показать дополнительные настройки'}
            </button>
            {showAdvanced ? (
              <div className="form-grid" style={{ marginTop: 12 }}>
                <div>
                  <div className="form-section-title">Технический код</div>
                  <input
                    className="input"
                    value={form.slug}
                    placeholder="recovery-basics"
                    onChange={(event) => {
                      setSlugTouched(true)
                      setForm({ ...form, slug: event.target.value })
                    }}
                  />
                  <p className="field-hint">
                    Нужен приложению для ссылок. Обычно создаётся сам из
                    заголовка.
                  </p>
                </div>
                <div>
                  <div className="form-section-title">Порядок в ленте</div>
                  <input
                    className="input"
                    type="number"
                    value={form.sortOrder}
                    onChange={(event) =>
                      setForm({ ...form, sortOrder: event.target.value })
                    }
                  />
                  <p className="field-hint">
                    Чем меньше число, тем раньше история в списке.
                  </p>
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
              </div>
            ) : null}
          </div>

          {error ? (
            <div style={{ gridColumn: '1 / -1', color: '#fca5a5' }}>{error}</div>
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
                  ? 'Сохранить'
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
        <div className="form-section-title">Уже опубликованные</div>
        {isLoading ? <p className="field-hint">Загрузка...</p> : null}
        {!isLoading && stories?.length === 0 ? (
          <p className="field-hint">Пока пусто — добавьте первую историю выше.</p>
        ) : null}
        <div className="content-card-grid" style={{ marginTop: 12 }}>
          {stories?.map((story) => (
            <article key={story.id} className="content-card">
              {story.coverImageUrl ? (
                <img
                  className="content-card-media"
                  src={toAbsoluteMediaUrl(story.coverImageUrl)}
                  alt=""
                />
              ) : (
                <div className="content-card-media" />
              )}
              <div className="content-card-body">
                <h3 className="content-card-title">{story.title}</h3>
                <div className="content-card-meta">
                  {categoryLabels[story.category]} · {story.readMinutes} мин ·{' '}
                  {story.isActive ? 'видна' : 'скрыта'}
                </div>
                <div className="content-card-meta">
                  Просмотрели: {story.uniqueViewerCount} ·{' '}
                  {dayjs(story.publishedAt).format('DD.MM.YYYY')}
                </div>
                <div className="table-actions" style={{ marginTop: 'auto' }}>
                  <button
                    className="button"
                    type="button"
                    onClick={() => startEditing(story)}
                  >
                    Изменить
                  </button>
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={() => handleDelete(story)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

export default WellnessStoriesPage

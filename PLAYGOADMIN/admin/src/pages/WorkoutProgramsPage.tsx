import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { api } from '../api/client'
import {
  useDeleteMutation,
  usePostMutation,
  usePutMutation,
  useUploadWorkoutStepIllustration,
  useWorkoutPrograms,
  useWorkoutSteps,
} from '../api/hooks'
import Select from '../components/Select'
import { slugify } from '../lib/slugify'
import type {
  WorkoutPhase,
  WorkoutProgram,
  WorkoutStep,
} from '../types'

const phaseOptions: Array<{ value: WorkoutPhase; label: string }> = [
  { value: 'warmup', label: 'Разминка' },
  { value: 'work', label: 'Основная работа' },
  { value: 'rest', label: 'Отдых' },
  { value: 'cooldown', label: 'Заминка' },
]

const phaseLabels = Object.fromEntries(
  phaseOptions.map((option) => [option.value, option.label]),
) as Record<WorkoutPhase, string>

const iconOptions = [
  { value: '', label: 'Без иконки' },
  { value: 'sports_mma', label: 'Бокс / единоборства' },
  { value: 'fitness_center', label: 'Силовая тренировка' },
  { value: 'directions_run', label: 'Кардио' },
  { value: 'self_improvement', label: 'Восстановление' },
  { value: 'accessibility_new', label: 'Растяжка / мобилити' },
]

const emptyProgramForm = () => ({
  id: '',
  title: '',
  subtitle: '',
  description: '',
  guide: '',
  iconKey: 'sports_mma',
  gradientStart: '#E8F5EC',
  gradientEnd: '#86EFAC',
  estimatedMinutes: '15',
  sortOrder: '0',
  isActive: 'true',
})

const emptyStepForm = () => ({
  phase: 'work' as WorkoutPhase,
  title: '',
  description: '',
  durationSeconds: '60',
})

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (!minutes) return `${remainder} сек`
  if (!remainder) return `${minutes} мин`
  return `${minutes} мин ${remainder} сек`
}

const toAbsoluteMediaUrl = (url: string) => {
  const base =
    api.defaults.baseURL?.replace(/\/api(?:\/admin)?$/, '') ||
    window.location.origin
  return new URL(url, base).toString()
}

function WorkoutProgramsPage() {
  const { data: programs, isLoading } = useWorkoutPrograms()
  const [editingId, setEditingId] = useState<string | null>(null)
  const { data: steps = [] } = useWorkoutSteps(editingId)

  const createProgram = usePostMutation('/workout-programs', [
    'workout-programs',
  ])
  const updateProgram = usePutMutation(
    (payload) => `/workout-programs/${payload.id}`,
    ['workout-programs'],
  )
  const deleteProgram = useDeleteMutation(
    (id) => `/workout-programs/${id}`,
    ['workout-programs'],
  )
  const createStep = usePostMutation(
    `/workout-programs/${editingId}/steps`,
    ['workout-programs', ['workout-programs', editingId || '', 'steps']],
  )
  const updateStep = usePutMutation(
    (payload) =>
      `/workout-programs/${editingId}/steps/${payload.stepId}`,
    ['workout-programs', ['workout-programs', editingId || '', 'steps']],
  )
  const reorderSteps = usePutMutation(
    () => `/workout-programs/${editingId}/steps/reorder`,
    ['workout-programs', ['workout-programs', editingId || '', 'steps']],
  )
  const deleteStep = useDeleteMutation(
    (stepId) => `/workout-programs/${editingId}/steps/${stepId}`,
    ['workout-programs', ['workout-programs', editingId || '', 'steps']],
  )
  const uploadIllustration = useUploadWorkoutStepIllustration()

  const [programForm, setProgramForm] = useState(emptyProgramForm)
  const [idTouched, setIdTouched] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [stepForm, setStepForm] = useState(emptyStepForm)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [illustrationFile, setIllustrationFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  const selectedProgram = useMemo(
    () => programs?.find((program) => program.id === editingId),
    [editingId, programs],
  )

  const resetStepForm = () => {
    setEditingStepId(null)
    setStepForm(emptyStepForm())
    setIllustrationFile(null)
  }

  const resetProgramForm = () => {
    setEditingId(null)
    setProgramForm(emptyProgramForm())
    setIdTouched(false)
    setShowAdvanced(false)
    resetStepForm()
    setError('')
  }

  const handleTitleChange = (title: string) => {
    setProgramForm((current) => ({
      ...current,
      title,
      id:
        !editingId && !idTouched
          ? slugify(title, 'workout')
          : current.id,
    }))
  }

  const startEditingProgram = (program: WorkoutProgram) => {
    setEditingId(program.id)
    setIdTouched(true)
    setShowAdvanced(false)
    setProgramForm({
      id: program.id,
      title: program.title,
      subtitle: program.subtitle || '',
      description: program.description,
      guide: program.guide || '',
      iconKey: program.iconKey || '',
      gradientStart: program.gradientStart || '#E8F5EC',
      gradientEnd: program.gradientEnd || '#86EFAC',
      estimatedMinutes: program.estimatedMinutes
        ? String(program.estimatedMinutes)
        : '',
      sortOrder: String(program.sortOrder),
      isActive: program.isActive ? 'true' : 'false',
    })
    resetStepForm()
    setError('')
  }

  const handleProgramSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const programId =
      programForm.id.trim() || slugify(programForm.title, 'workout')
    if (!programForm.title.trim() || !programForm.description.trim()) {
      setError('Нужны название и короткое описание программы')
      return
    }

    const payload = {
      id: programId,
      title: programForm.title.trim(),
      subtitle: programForm.subtitle.trim() || null,
      description: programForm.description.trim(),
      guide: programForm.guide.trim() || null,
      iconKey: programForm.iconKey.trim() || null,
      gradientStart: programForm.gradientStart.trim() || null,
      gradientEnd: programForm.gradientEnd.trim() || null,
      estimatedMinutes: programForm.estimatedMinutes
        ? Number(programForm.estimatedMinutes)
        : null,
      sortOrder: Number(programForm.sortOrder) || 0,
      isActive: programForm.isActive === 'true',
      locale: 'ru',
    }

    try {
      const saved = editingId
        ? ((await updateProgram.mutateAsync(payload)) as WorkoutProgram)
        : ((await createProgram.mutateAsync(payload)) as WorkoutProgram)
      startEditingProgram(saved)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Не удалось сохранить программу',
      )
    }
  }

  const handleDeleteProgram = async (program: WorkoutProgram) => {
    if (
      !window.confirm(
        `Удалить программу «${program.title}» вместе со всеми шагами?`,
      )
    ) {
      return
    }
    try {
      await deleteProgram.mutateAsync(program.id)
      if (editingId === program.id) resetProgramForm()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Не удалось удалить программу',
      )
    }
  }

  const startEditingStep = (step: WorkoutStep) => {
    setEditingStepId(step.id)
    setStepForm({
      phase: step.phase,
      title: step.title,
      description: step.description || '',
      durationSeconds: String(step.durationSeconds),
    })
    setIllustrationFile(null)
    setError('')
  }

  const handleStepSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingId) return
    setError('')
    if (!stepForm.title.trim()) {
      setError('Нужно название шага')
      return
    }

    const payload = {
      phase: stepForm.phase,
      title: stepForm.title.trim(),
      description: stepForm.description.trim() || null,
      durationSeconds: Number(stepForm.durationSeconds) || 60,
      poseIndex: null,
    }

    try {
      const saved = editingStepId
        ? ((await updateStep.mutateAsync({
            stepId: editingStepId,
            ...payload,
          })) as WorkoutStep)
        : ((await createStep.mutateAsync(payload)) as WorkoutStep)
      if (illustrationFile) {
        await uploadIllustration.mutateAsync({
          programId: editingId,
          stepId: saved.id,
          file: illustrationFile,
        })
      }
      resetStepForm()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Не удалось сохранить шаг',
      )
    }
  }

  const handleDeleteStep = async (step: WorkoutStep) => {
    if (!window.confirm(`Удалить шаг «${step.title}»?`)) return
    try {
      await deleteStep.mutateAsync(step.id)
      if (editingStepId === step.id) resetStepForm()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Не удалось удалить шаг',
      )
    }
  }

  const moveStep = async (stepId: string, direction: -1 | 1) => {
    const currentIndex = steps.findIndex((step) => step.id === stepId)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= steps.length) return
    const reordered = [...steps]
    const [item] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, item)
    try {
      await reorderSteps.mutateAsync({
        stepIds: reordered.map((step) => step.id),
      })
      setError('')
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Не удалось изменить порядок',
      )
    }
  }

  const handleIllustrationChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setIllustrationFile(event.target.files?.[0] || null)
  }

  const isProgramSaving =
    createProgram.isPending || updateProgram.isPending
  const isStepSaving =
    createStep.isPending ||
    updateStep.isPending ||
    uploadIllustration.isPending

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">EVENTUM CLUBS</div>
          <h2 style={{ margin: '4px 0 0' }}>Программы тренировок</h2>
          <p className="page-intro">
            Сначала создайте карточку программы, потом добавьте шаги таймера:
            разминка, работа, отдых, заминка.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="form-section-title">
          {editingId ? 'Редактирование программы' : 'Новая программа'}
        </div>
        <form className="form-grid" onSubmit={handleProgramSubmit}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Название</div>
            <input
              className="input"
              value={programForm.title}
              placeholder="Например: Функциональный старт"
              onChange={(event) => handleTitleChange(event.target.value)}
            />
          </div>
          <div>
            <div className="form-section-title">Короткий подзаголовок</div>
            <input
              className="input"
              value={programForm.subtitle}
              placeholder="Например: 15 минут дома"
              onChange={(event) =>
                setProgramForm({ ...programForm, subtitle: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Сколько минут займёт</div>
            <input
              className="input"
              type="number"
              min={1}
              value={programForm.estimatedMinutes}
              onChange={(event) =>
                setProgramForm({
                  ...programForm,
                  estimatedMinutes: event.target.value,
                })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Иконка</div>
            <Select
              value={programForm.iconKey}
              onChange={(iconKey) =>
                setProgramForm({ ...programForm, iconKey })
              }
              options={
                iconOptions.some((option) => option.value === programForm.iconKey)
                  ? iconOptions
                  : [
                      ...iconOptions,
                      {
                        value: programForm.iconKey,
                        label: `Текущая: ${programForm.iconKey}`,
                      },
                    ]
              }
              fullWidth
            />
          </div>
          <div>
            <div className="form-section-title">Показывать в приложении</div>
            <Select
              value={programForm.isActive}
              onChange={(isActive) =>
                setProgramForm({ ...programForm, isActive })
              }
              options={[
                { value: 'true', label: 'Да, опубликовать' },
                { value: 'false', label: 'Нет, скрыть' },
              ]}
              fullWidth
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Описание для карточки</div>
            <textarea
              className="textarea"
              rows={3}
              value={programForm.description}
              placeholder="Коротко объясните, для кого эта тренировка и что будет внутри."
              onChange={(event) =>
                setProgramForm({
                  ...programForm,
                  description: event.target.value,
                })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Цвет начала</div>
            <div className="color-field">
              <input
                type="color"
                value={programForm.gradientStart || '#E8F5EC'}
                onChange={(event) =>
                  setProgramForm({
                    ...programForm,
                    gradientStart: event.target.value,
                  })
                }
              />
              <input
                className="input"
                value={programForm.gradientStart}
                onChange={(event) =>
                  setProgramForm({
                    ...programForm,
                    gradientStart: event.target.value,
                  })
                }
              />
            </div>
          </div>
          <div>
            <div className="form-section-title">Цвет конца</div>
            <div className="color-field">
              <input
                type="color"
                value={programForm.gradientEnd || '#86EFAC'}
                onChange={(event) =>
                  setProgramForm({
                    ...programForm,
                    gradientEnd: event.target.value,
                  })
                }
              />
              <input
                className="input"
                value={programForm.gradientEnd}
                onChange={(event) =>
                  setProgramForm({
                    ...programForm,
                    gradientEnd: event.target.value,
                  })
                }
              />
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Как будет выглядеть фон</div>
            <div
              className="gradient-preview"
              style={{
                background: `linear-gradient(135deg, ${programForm.gradientStart || '#E8F5EC'}, ${programForm.gradientEnd || '#86EFAC'})`,
              }}
            />
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
                    value={programForm.id}
                    disabled={Boolean(editingId)}
                    placeholder="home-full"
                    onChange={(event) => {
                      setIdTouched(true)
                      setProgramForm({
                        ...programForm,
                        id: event.target.value,
                      })
                    }}
                  />
                  <p className="field-hint">
                    Создаётся сам из названия. После сохранения менять нельзя.
                  </p>
                </div>
                <div>
                  <div className="form-section-title">Порядок в списке</div>
                  <input
                    className="input"
                    type="number"
                    value={programForm.sortOrder}
                    onChange={(event) =>
                      setProgramForm({
                        ...programForm,
                        sortOrder: event.target.value,
                      })
                    }
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="form-section-title">
                    Старый текст-гайд (необязательно)
                  </div>
                  <textarea
                    className="textarea"
                    rows={4}
                    value={programForm.guide}
                    placeholder="Если приложение ещё читает старый текстовый гайд — можно оставить его здесь."
                    onChange={(event) =>
                      setProgramForm({
                        ...programForm,
                        guide: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            <button className="button" type="submit" disabled={isProgramSaving}>
              {isProgramSaving
                ? 'Сохранение...'
                : editingId
                  ? 'Сохранить программу'
                  : 'Создать и добавить шаги'}
            </button>
            {editingId ? (
              <button
                className="button button-muted"
                type="button"
                onClick={resetProgramForm}
              >
                Новая программа
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {editingId ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="section-header">
            <div>
              <div className="form-section-title">
                Шаги таймера: {selectedProgram?.title || editingId}
              </div>
              <p className="field-hint">
                {steps.length} шагов ·{' '}
                {formatDuration(
                  steps.reduce(
                    (total, step) => total + step.durationSeconds,
                    0,
                  ),
                )}
              </p>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleStepSubmit}>
            <div>
              <div className="form-section-title">Тип шага</div>
              <Select
                value={stepForm.phase}
                onChange={(phase) =>
                  setStepForm({ ...stepForm, phase: phase as WorkoutPhase })
                }
                options={phaseOptions}
                fullWidth
              />
            </div>
            <div>
              <div className="form-section-title">Название шага</div>
              <input
                className="input"
                value={stepForm.title}
                placeholder="Например: Отжимания"
                onChange={(event) =>
                  setStepForm({ ...stepForm, title: event.target.value })
                }
              />
            </div>
            <div>
              <div className="form-section-title">Длительность, секунды</div>
              <input
                className="input"
                type="number"
                min={1}
                value={stepForm.durationSeconds}
                onChange={(event) =>
                  setStepForm({
                    ...stepForm,
                    durationSeconds: event.target.value,
                  })
                }
              />
              <p className="field-hint">
                60 = 1 минута, 90 = 1,5 минуты.
              </p>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="form-section-title">Подсказка пользователю</div>
              <textarea
                className="textarea"
                rows={3}
                value={stepForm.description}
                placeholder="Как правильно выполнить шаг."
                onChange={(event) =>
                  setStepForm({
                    ...stepForm,
                    description: event.target.value,
                  })
                }
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="form-section-title">Картинка шага</div>
              <input
                className="input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleIllustrationChange}
              />
              <p className="field-hint">
                Необязательно. JPG, PNG, WebP или GIF до 5 МБ.
              </p>
            </div>
            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button className="button" type="submit" disabled={isStepSaving}>
                {isStepSaving
                  ? 'Сохранение...'
                  : editingStepId
                    ? 'Сохранить шаг'
                    : 'Добавить шаг'}
              </button>
              {editingStepId ? (
                <button
                  className="button button-muted"
                  type="button"
                  onClick={resetStepForm}
                >
                  Отмена
                </button>
              ) : null}
            </div>
          </form>

          <table className="table" style={{ marginTop: 18 }}>
            <thead>
              <tr>
                <th>Порядок</th>
                <th>Тип</th>
                <th>Шаг</th>
                <th>Время</th>
                <th>Картинка</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {steps.map((step, index) => (
                <tr key={step.id}>
                  <td>
                    <div className="table-actions">
                      <button
                        className="button button-muted"
                        type="button"
                        disabled={index === 0 || reorderSteps.isPending}
                        onClick={() => moveStep(step.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        className="button button-muted"
                        type="button"
                        disabled={
                          index === steps.length - 1 || reorderSteps.isPending
                        }
                        onClick={() => moveStep(step.id, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td>{phaseLabels[step.phase]}</td>
                  <td>{step.title}</td>
                  <td>{formatDuration(step.durationSeconds)}</td>
                  <td>
                    {step.illustrationUrl ? (
                      <img
                        src={toAbsoluteMediaUrl(step.illustrationUrl)}
                        alt=""
                        style={{
                          width: 72,
                          height: 52,
                          objectFit: 'cover',
                          borderRadius: 8,
                        }}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-right">
                    <div className="table-actions">
                      <button
                        className="button"
                        type="button"
                        onClick={() => startEditingStep(step)}
                      >
                        Изменить
                      </button>
                      <button
                        className="button button-danger"
                        type="button"
                        onClick={() => handleDeleteStep(step)}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {steps.length === 0 ? (
                <tr>
                  <td colSpan={6}>Шагов пока нет — добавьте первый выше.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12, color: '#fca5a5' }}>{error}</div>
      ) : null}

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="form-section-title">Все программы</div>
        {isLoading ? <p className="field-hint">Загрузка...</p> : null}
        {!isLoading && programs?.length === 0 ? (
          <p className="field-hint">
            Пока пусто — создайте первую программу выше.
          </p>
        ) : null}
        <div className="content-card-grid" style={{ marginTop: 12 }}>
          {programs?.map((program) => (
            <article key={program.id} className="content-card">
              <div
                className="content-card-media"
                style={{
                  background: `linear-gradient(135deg, ${program.gradientStart || '#E8F5EC'}, ${program.gradientEnd || '#86EFAC'})`,
                }}
              />
              <div className="content-card-body">
                <h3 className="content-card-title">{program.title}</h3>
                <div className="content-card-meta">
                  {program.subtitle || 'Без подзаголовка'} ·{' '}
                  {program.isActive ? 'видна' : 'скрыта'}
                </div>
                <div className="content-card-meta">
                  {program.stepCount} шагов ·{' '}
                  {formatDuration(program.totalDurationSeconds)} · смотрели{' '}
                  {program.uniqueViewerCount}
                </div>
                <div className="table-actions" style={{ marginTop: 'auto' }}>
                  <button
                    className="button"
                    type="button"
                    onClick={() => startEditingProgram(program)}
                  >
                    Открыть
                  </button>
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={() => handleDeleteProgram(program)}
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

export default WorkoutProgramsPage

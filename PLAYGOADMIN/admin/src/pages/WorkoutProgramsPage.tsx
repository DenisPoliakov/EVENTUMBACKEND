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
import type {
  WorkoutPhase,
  WorkoutProgram,
  WorkoutStep,
} from '../types'

const phaseOptions: Array<{ value: WorkoutPhase; label: string }> = [
  { value: 'warmup', label: 'Разминка' },
  { value: 'work', label: 'Работа' },
  { value: 'rest', label: 'Отдых' },
  { value: 'cooldown', label: 'Заминка' },
]

const phaseLabels = Object.fromEntries(
  phaseOptions.map((option) => [option.value, option.label]),
) as Record<WorkoutPhase, string>

const emptyProgramForm = () => ({
  id: '',
  title: '',
  subtitle: '',
  description: '',
  guide: '',
  iconKey: '',
  gradientStart: '',
  gradientEnd: '',
  estimatedMinutes: '',
  sortOrder: '0',
  isActive: 'true',
})

const emptyStepForm = () => ({
  phase: 'work' as WorkoutPhase,
  title: '',
  description: '',
  durationSeconds: '90',
  poseIndex: '',
})

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
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
  const [stepForm, setStepForm] = useState(emptyStepForm)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [illustrationFile, setIllustrationFile] = useState<File | null>(null)
  const [orderValues, setOrderValues] = useState<Record<string, string>>({})
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
    resetStepForm()
    setError('')
  }

  const startEditingProgram = (program: WorkoutProgram) => {
    setEditingId(program.id)
    setProgramForm({
      id: program.id,
      title: program.title,
      subtitle: program.subtitle || '',
      description: program.description,
      guide: program.guide || '',
      iconKey: program.iconKey || '',
      gradientStart: program.gradientStart || '',
      gradientEnd: program.gradientEnd || '',
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
    if (
      !programForm.id.trim() ||
      !programForm.title.trim() ||
      !programForm.description.trim()
    ) {
      setError('Заполните ID, название и описание программы')
      return
    }

    const payload = {
      id: programForm.id.trim(),
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
      sortOrder: Number(programForm.sortOrder),
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
      poseIndex: step.poseIndex === null ? '' : String(step.poseIndex),
    })
    setIllustrationFile(null)
    setError('')
  }

  const handleStepSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingId) return
    setError('')
    if (!stepForm.title.trim()) {
      setError('Заполните название шага')
      return
    }

    const payload = {
      phase: stepForm.phase,
      title: stepForm.title.trim(),
      description: stepForm.description.trim() || null,
      durationSeconds: Number(stepForm.durationSeconds),
      poseIndex: stepForm.poseIndex === '' ? null : Number(stepForm.poseIndex),
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

  const handleReorder = async () => {
    const ranked = steps.map((step) => ({
      id: step.id,
      order: Number(orderValues[step.id] ?? step.order),
    }))
    if (
      ranked.some((item) => !Number.isInteger(item.order) || item.order < 1) ||
      new Set(ranked.map((item) => item.order)).size !== ranked.length
    ) {
      setError('Порядок должен состоять из уникальных положительных чисел')
      return
    }
    try {
      await reorderSteps.mutateAsync({
        stepIds: ranked
          .sort((left, right) => left.order - right.order)
          .map((item) => item.id),
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
          <div className="small-label">Wellness</div>
          <h2 style={{ margin: '4px 0 0' }}>Программы тренировок</h2>
        </div>
      </div>

      <div className="panel">
        <form className="form-grid" onSubmit={handleProgramSubmit}>
          <div>
            <div className="form-section-title">Стабильный ID (slug)</div>
            <input
              className="input"
              value={programForm.id}
              disabled={Boolean(editingId)}
              placeholder="home-full"
              onChange={(event) =>
                setProgramForm({ ...programForm, id: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Название</div>
            <input
              className="input"
              value={programForm.title}
              onChange={(event) =>
                setProgramForm({ ...programForm, title: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Подзаголовок</div>
            <input
              className="input"
              value={programForm.subtitle}
              onChange={(event) =>
                setProgramForm({ ...programForm, subtitle: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Иконка / ключ</div>
            <input
              className="input"
              value={programForm.iconKey}
              onChange={(event) =>
                setProgramForm({ ...programForm, iconKey: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Цвет начала</div>
            <input
              className="input"
              value={programForm.gradientStart}
              placeholder="#E8F5EC"
              onChange={(event) =>
                setProgramForm({
                  ...programForm,
                  gradientStart: event.target.value,
                })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Цвет конца</div>
            <input
              className="input"
              value={programForm.gradientEnd}
              placeholder="#86EFAC"
              onChange={(event) =>
                setProgramForm({
                  ...programForm,
                  gradientEnd: event.target.value,
                })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Оценка, мин.</div>
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
            <div className="form-section-title">Порядок</div>
            <input
              className="input"
              type="number"
              value={programForm.sortOrder}
              onChange={(event) =>
                setProgramForm({ ...programForm, sortOrder: event.target.value })
              }
            />
          </div>
          <div>
            <div className="form-section-title">Активна</div>
            <Select
              value={programForm.isActive}
              onChange={(isActive) =>
                setProgramForm({ ...programForm, isActive })
              }
              options={[
                { value: 'true', label: 'Да' },
                { value: 'false', label: 'Нет' },
              ]}
              fullWidth
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Описание карточки</div>
            <textarea
              className="textarea"
              rows={3}
              value={programForm.description}
              onChange={(event) =>
                setProgramForm({
                  ...programForm,
                  description: event.target.value,
                })
              }
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Legacy-гайд (опционально)</div>
            <textarea
              className="textarea"
              rows={5}
              value={programForm.guide}
              onChange={(event) =>
                setProgramForm({ ...programForm, guide: event.target.value })
              }
            />
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
                  : 'Добавить программу'}
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
                Шаги: {selectedProgram?.title || editingId}
              </div>
              <div>
                {steps.length} шагов ·{' '}
                {formatDuration(
                  steps.reduce(
                    (total, step) => total + step.durationSeconds,
                    0,
                  ),
                )}
              </div>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleStepSubmit}>
            <div>
              <div className="form-section-title">Фаза</div>
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
                onChange={(event) =>
                  setStepForm({ ...stepForm, title: event.target.value })
                }
              />
            </div>
            <div>
              <div className="form-section-title">Длительность, сек.</div>
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
            </div>
            <div>
              <div className="form-section-title">Индекс позы (0–5)</div>
              <input
                className="input"
                type="number"
                min={0}
                max={5}
                value={stepForm.poseIndex}
                onChange={(event) =>
                  setStepForm({ ...stepForm, poseIndex: event.target.value })
                }
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="form-section-title">Описание</div>
              <textarea
                className="textarea"
                rows={3}
                value={stepForm.description}
                onChange={(event) =>
                  setStepForm({
                    ...stepForm,
                    description: event.target.value,
                  })
                }
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="form-section-title">
                Иллюстрация (JPEG, PNG, WebP или GIF; до 5 МБ)
              </div>
              <input
                className="input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleIllustrationChange}
              />
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
                <th>Фаза</th>
                <th>Шаг</th>
                <th>Время</th>
                <th>Иллюстрация</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {steps.map((step) => (
                <tr key={step.id}>
                  <td>
                    <input
                      className="input"
                      style={{ width: 80 }}
                      type="number"
                      min={1}
                      value={orderValues[step.id] ?? String(step.order)}
                      onChange={(event) =>
                        setOrderValues({
                          ...orderValues,
                          [step.id]: event.target.value,
                        })
                      }
                    />
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
                  <td colSpan={6}>Шагов пока нет</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {steps.length > 1 ? (
            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <button
                className="button"
                type="button"
                disabled={reorderSteps.isPending}
                onClick={handleReorder}
              >
                {reorderSteps.isPending
                  ? 'Сохранение...'
                  : 'Применить порядок'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12, color: '#fca5a5' }}>{error}</div>
      ) : null}

      <div className="panel" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Программа</th>
              <th>ID</th>
              <th>Статус</th>
              <th>Порядок</th>
              <th>Шаги</th>
              <th>Длительность</th>
              <th>Просмотрели (уник.)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {programs?.map((program) => (
              <tr key={program.id}>
                <td>{program.title}</td>
                <td>{program.id}</td>
                <td>{program.isActive ? 'Активна' : 'Скрыта'}</td>
                <td>{program.sortOrder}</td>
                <td>{program.stepCount}</td>
                <td>{formatDuration(program.totalDurationSeconds)}</td>
                <td>{program.uniqueViewerCount}</td>
                <td className="text-right">
                  <div className="table-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => startEditingProgram(program)}
                    >
                      Редактировать
                    </button>
                    <button
                      className="button button-danger"
                      type="button"
                      onClick={() => handleDeleteProgram(program)}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && programs?.length === 0 ? (
              <tr>
                <td colSpan={8}>Программ пока нет</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default WorkoutProgramsPage

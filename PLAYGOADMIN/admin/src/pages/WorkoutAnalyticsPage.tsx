import { useState } from 'react'

import { useWorkoutAnalytics } from '../api/hooks'

const toInputDate = (date: Date) => date.toISOString().slice(0, 10)

function WorkoutAnalyticsPage() {
  const [from, setFrom] = useState(() => toInputDate(new Date(Date.now() - 30 * 86_400_000)))
  const [to, setTo] = useState(() => toInputDate(new Date()))
  const query = useWorkoutAnalytics({
    from: new Date(`${from}T00:00:00.000Z`).toISOString(),
    to: new Date(`${to}T23:59:59.999Z`).toISOString(),
  })
  const metrics = query.data?.metrics

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Wellness analytics</div>
          <h2 style={{ margin: '4px 0 0' }}>Аналитика тренировок</h2>
        </div>
      </div>
      <div className="panel">
        <div className="form-grid">
          <label>С даты<input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>По дату<input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <p className="small-label">Максимальный диапазон — 366 дней. По умолчанию показываются последние 30 дней.</p>
        {query.isError && <p style={{ color: '#fca5a5' }}>Не удалось загрузить аналитику.</p>}
      </div>
      <div className="cards-grid" style={{ marginTop: 16 }}>
        <div className="panel"><span className="small-label">Сессии</span><h2>{metrics?.sessions ?? '—'}</h2></div>
        <div className="panel"><span className="small-label">Уникальные пользователи</span><h2>{metrics?.users ?? '—'}</h2></div>
        <div className="panel"><span className="small-label">Минуты тренировок</span><h2>{metrics ? Math.round(metrics.durationSeconds / 60) : '—'}</h2></div>
        <div className="panel"><span className="small-label">Средняя длительность</span><h2>{metrics ? `${Math.round(metrics.averageDurationSeconds / 60)} мин` : '—'}</h2></div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Популярные программы</h3>
        <table className="table">
          <thead><tr><th>Программа</th><th>Сессии</th><th>Минуты</th><th>Статус</th></tr></thead>
          <tbody>
            {query.data?.popularPrograms.map((program) => (
              <tr key={program.programId}>
                <td>{program.title}<br /><span className="small-label">{program.programId}</span></td>
                <td>{program.sessions}</td>
                <td>{Math.round(program.durationSeconds / 60)}</td>
                <td>{program.isActive ? 'Активна' : 'Отключена'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default WorkoutAnalyticsPage

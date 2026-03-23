import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useCities, useDeleteMutation, usePostMutation } from '../api/hooks'
import type { City } from '../types'

type RuCity = { name: string; subject?: string; coords?: { lat: string; lon: string } }

function CitiesPage() {
  const { data: cities } = useCities()
  const createCity = usePostMutation('/cities', ['cities'])
  const deleteCity = useDeleteMutation((id) => `/cities/${id}`, ['cities'])

  const [name, setName] = useState('')
  const [allRuCities, setAllRuCities] = useState<RuCity[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openList, setOpenList] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingList(true)
        const res = await fetch('/russian-cities.json')
        const data = (await res.json()) as RuCity[]
        setAllRuCities(data)
      } catch (err) {
        setError('Не удалось загрузить список городов')
      } finally {
        setLoadingList(false)
      }
    }
    load()
  }, [])

  const suggestions = useMemo(() => {
    if (!name) return []
    const q = name.trim().toLowerCase()
    return allRuCities.filter((c) => c.name.toLowerCase().startsWith(q)).slice(0, 5)
  }, [name, allRuCities])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createCity.mutate({ name })
    setName('')
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Справочник</div>
          <h2 style={{ margin: '4px 0 0' }}>Города</h2>
        </div>
      </div>

      <div className="panel">
        <form onSubmit={handleSubmit} className="actions-row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              className="input"
              placeholder="Начните вводить (например, М...)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {suggestions.length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--panel-alt)',
                  padding: 6,
                  maxWidth: 400,
                }}
              >
                {suggestions.map((s) => (
                  <div
                    key={s.name}
                    style={{ padding: '6px 8px', cursor: 'pointer' }}
                    onClick={() => setName(s.name)}
                  >
                    {s.name}
                    {s.subject ? <span style={{ color: '#8da2b5', marginLeft: 6, fontSize: 12 }}>{s.subject}</span> : null}
                  </div>
                ))}
              </div>
            )}
            {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{error}</div>}
          </div>

          <div style={{ minWidth: 240, position: 'relative' }}>
            <button
              type="button"
              className="input"
              style={{ textAlign: 'left', cursor: 'pointer' }}
              onClick={() => setOpenList((v) => !v)}
              disabled={loadingList || allRuCities.length === 0}
            >
              {loadingList ? 'Загрузка...' : name || 'Выберите город'}
            </button>
            {openList && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  maxHeight: 260,
                  overflowY: 'auto',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--panel-alt)',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.25)',
                  zIndex: 10,
                }}
              >
                {allRuCities.map((c) => (
                  <div
                    key={c.name}
                    style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onClick={() => {
                      setName(c.name)
                      setOpenList(false)
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(37,193,111,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {c.name}
                    {c.subject ? <span style={{ color: '#8da2b5', marginLeft: 6, fontSize: 12 }}>{c.subject}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="button" type="submit" disabled={createCity.isPending || !name.trim()}>
            Добавить
          </button>
        </form>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Название</th>
            </tr>
          </thead>
          <tbody>
            {cities?.map((city: City, idx: number) => (
              <tr key={city.id}>
                <td>{idx + 1}</td>
                <td style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{city.name}</span>
                  <button
                    className="button"
                    type="button"
                    style={{ background: '#ef4444', color: '#fff', padding: '6px 10px' }}
                    onClick={() => deleteCity.mutate(city.id)}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CitiesPage

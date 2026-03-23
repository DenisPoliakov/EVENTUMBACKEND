import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useCities, useDeleteMutation, usePostMutation, usePutMutation, useStadiums } from '../api/hooks'
import type { Stadium } from '../types'
import MapPicker from '../components/MapPicker'
import Select from '../components/Select'
import { api, uploadFile } from '../api/client'

type RuCity = { name: string; coords?: { lat: string; lon: string } }

function StadiumsPage() {
  const { data: cities } = useCities()
  const [cityId, setCityId] = useState<string>('')
  const { data: stadiums } = useStadiums(cityId || undefined)
  const createStadium = usePostMutation('/stadiums', [['stadiums', cityId || undefined]])
  const updateStadium = usePutMutation(
    (payload) => `/stadiums/${payload.id}`,
    [['stadiums', cityId || undefined]]
  )
  const deleteStadium = useDeleteMutation((id) => `/stadiums/${id}`, [['stadiums', cityId || undefined]])

  const [ruCities, setRuCities] = useState<RuCity[]>([])

  const [form, setForm] = useState({
    name: '',
    address: '',
    description: '',
    imageUrl: '',
    latitude: 55.751244,
    longitude: 37.618423,
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  // загрузка списка городов с координатами
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/russian-cities.json')
        const data = (await res.json()) as RuCity[]
        setRuCities(data)
      } catch (err) {
        // тихо, карта всё равно работает вручную
      }
    }
    load()
  }, [])

  // при выборе города проставляем координаты центра
  useEffect(() => {
    if (!cityId) return
    const city = cities?.find((c) => c.id === cityId)
    if (!city) return
    const ruCity = ruCities.find((c) => c.name.toLowerCase() === city.name.toLowerCase())
    if (ruCity?.coords?.lat && ruCity?.coords?.lon) {
      setForm((prev) => ({
        ...prev,
        latitude: Number(ruCity.coords?.lat ?? prev.latitude),
        longitude: Number(ruCity.coords?.lon ?? prev.longitude),
      }))
    }
  }, [cityId, cities, ruCities])

  const currentCityCoords = useMemo(() => {
    const city = cities?.find((c) => c.id === cityId)
    if (!city) return undefined
    const ruCity = ruCities.find((c) => c.name.toLowerCase() === city.name.toLowerCase())
    if (ruCity?.coords?.lat && ruCity?.coords?.lon) {
      return { lat: Number(ruCity.coords?.lat ?? form.latitude), lng: Number(ruCity.coords?.lon ?? form.longitude) }
    }
    return { lat: form.latitude, lng: form.longitude }
  }, [cities, cityId, ruCities, form.latitude, form.longitude])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!cityId || !form.name.trim() || !form.address.trim()) return
    if (editingId) {
      updateStadium.mutate({ id: editingId, ...form, cityId })
    } else {
      createStadium.mutate({ ...form, cityId })
    }
    setEditingId(null)
    setForm((f) => ({ ...f, name: '', address: '', description: '', imageUrl: '' }))
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Локации</div>
          <h2 style={{ margin: '4px 0 0' }}>Стадионы</h2>
        </div>
        <div style={{ minWidth: 240 }}>
          <Select
            value={cityId}
            onChange={setCityId}
            placeholder="Все города"
            options={[{ value: '', label: 'Все города' }, ...(cities || []).map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
      </div>

      <div className="panel">
        <div className="form-grid">
          <div>
            <div className="form-section-title">Город</div>
            <Select
              value={cityId}
              onChange={setCityId}
              placeholder="Выберите"
              options={[{ value: '', label: 'Выберите' }, ...(cities || []).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div>
            <div className="form-section-title">Название</div>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Адрес</div>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <div className="form-section-title">Ссылка на изображение</div>
            <input className="input" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
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
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title">Описание</div>
            <textarea
              className="textarea"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>

        <div className="form-section-title" style={{ marginTop: 16 }}>
          Координаты (клик по карте)
        </div>
        <div className="map-wrapper">
          <MapPicker
            value={{ lat: form.latitude, lng: form.longitude }}
            center={currentCityCoords}
            onChange={(coords) => setForm({ ...form, latitude: coords.lat, longitude: coords.lng })}
          />
        </div>

        <div className="actions-row" style={{ marginTop: 16 }}>
          <div className="small-label">lat: {form.latitude.toFixed(6)} | lng: {form.longitude.toFixed(6)}</div>
          <button className="button" onClick={handleSubmit} disabled={!cityId || createStadium.isPending}>
            {editingId ? 'Сохранить изменения' : 'Сохранить стадион'}
          </button>
          {editingId && (
            <button
              className="button"
              type="button"
              style={{ background: '#6b7280', color: '#fff' }}
              onClick={() => {
                setEditingId(null)
                setForm((f) => ({ ...f, name: '', address: '', description: '', imageUrl: '' }))
              }}
            >
              Отмена
            </button>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Стадион</th>
              <th>Город</th>
              <th>Адрес</th>
              <th>Координаты</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {stadiums?.map((stadium: Stadium) => (
              <tr key={stadium.id}>
                <td>{stadium.name}</td>
                <td>{stadium.city?.name ?? '—'}</td>
                <td>{stadium.address}</td>
                <td className="small">
                  {Number(stadium.latitude).toFixed(5)}, {Number(stadium.longitude).toFixed(5)}
                </td>
                <td className="text-right">
                  <div className="table-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        setEditingId(stadium.id)
                        setCityId(stadium.cityId)
                        setForm({
                          name: stadium.name,
                          address: stadium.address,
                          description: stadium.description || '',
                          imageUrl: stadium.imageUrl || '',
                          latitude: Number(stadium.latitude),
                          longitude: Number(stadium.longitude),
                        })
                      }}
                    >
                      Редактировать
                    </button>
                    <button
                      className="button button-danger"
                      type="button"
                      onClick={() => deleteStadium.mutate(stadium.id)}
                    >
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

export default StadiumsPage

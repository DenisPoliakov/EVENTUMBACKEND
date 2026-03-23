import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useCities, usePatchMutation, useUsers } from '../api/hooks'
import type { User } from '../types'
import Select from '../components/Select'

function UsersPage() {
  const { data: cities } = useCities()
  const [q, setQ] = useState('')
  const [cityId, setCityId] = useState('')
  const [role, setRole] = useState('')
  const [blocked, setBlocked] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const filters = useMemo(
    () => ({
      q: q.trim() || undefined,
      cityId: cityId || undefined,
      role: role || undefined,
      blocked: blocked || undefined,
    }),
    [q, cityId, role, blocked]
  )

  const { data: users } = useUsers(filters)
  const moderateUser = usePatchMutation((payload) => `/users/${payload.id}/moderation`, [['users', filters]])

  const selectedUser = users?.find((user) => user.id === selectedUserId) || users?.[0] || null

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Модерация</div>
          <h2 style={{ margin: '4px 0 0' }}>Пользователи</h2>
        </div>
      </div>

      <div className="panel">
        <div className="actions-row" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ minWidth: 280, flex: 1 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по нику, email, имени"
          />
          <div style={{ minWidth: 220 }}>
            <Select
              value={cityId}
              onChange={setCityId}
              placeholder="Все города"
              options={[{ value: '', label: 'Все города' }, ...(cities || []).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <Select
              value={role}
              onChange={setRole}
              placeholder="Любая роль"
              options={[
                { value: '', label: 'Любая роль' },
                { value: 'USER', label: 'Пользователь' },
                { value: 'ADMIN', label: 'Админ' },
              ]}
            />
          </div>
          <div style={{ minWidth: 220 }}>
            <Select
              value={blocked}
              onChange={setBlocked}
              placeholder="Любой статус"
              options={[
                { value: '', label: 'Любой статус' },
                { value: 'active', label: 'Платформенно заблокирован' },
                { value: 'registration_ban', label: 'Бан на заявки' },
                { value: 'inactive', label: 'Без ограничений' },
              ]}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16, marginTop: 16 }}>
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Город</th>
                <th>Статус</th>
                <th>Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => {
                const platformBlocked = isPlatformBlocked(user)
                const matchBan = isMatchBanned(user)
                return (
                  <tr
                    key={user.id}
                    style={{ cursor: 'pointer', background: selectedUser?.id === user.id ? 'rgba(37,193,111,0.08)' : undefined }}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <td>
                      <div style={{ fontWeight: 700 }}>{user.username || 'без ника'}</div>
                      <div className="small-label">{user.email}</div>
                      <div className="small-label">{user.name}</div>
                    </td>
                    <td>{user.city?.name || '—'}</td>
                    <td>
                      {platformBlocked ? (
                        <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>Блок</span>
                      ) : matchBan ? (
                        <span className="badge" style={{ background: '#f59e0b', color: '#111827' }}>Бан заявок</span>
                      ) : (
                        <span className="badge tag-muted">Активен</span>
                      )}
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          {selectedUser ? (
            <UserModerationCard
              key={selectedUser.id}
              user={selectedUser}
              isSaving={moderateUser.isPending}
              onSave={(payload) => moderateUser.mutate({ id: selectedUser.id, ...payload })}
            />
          ) : (
            <div className="small-label">Пользователь не выбран</div>
          )}
        </div>
      </div>
    </div>
  )
}

function UserModerationCard({
  user,
  isSaving,
  onSave,
}: {
  user: User
  isSaving: boolean
  onSave: (payload: {
    username?: string
    isBlocked?: boolean
    blockReason?: string
    blockedUntil?: string | null
    matchBanUntil?: string | null
  }) => void
}) {
  const [username, setUsername] = useState(user.username || '')
  const [isBlocked, setIsBlocked] = useState(Boolean(user.isBlocked))
  const [blockReason, setBlockReason] = useState(user.blockReason || '')
  const [blockedUntil, setBlockedUntil] = useState(toLocalInput(user.blockedUntil))
  const [matchBanUntil, setMatchBanUntil] = useState(toLocalInput(user.matchBanUntil))
  const [showManualDates, setShowManualDates] = useState(false)

  const saveProfile = () =>
    onSave({
      username: username.trim(),
      isBlocked,
      blockReason: blockReason.trim(),
      blockedUntil: blockedUntil || null,
      matchBanUntil: matchBanUntil || null,
    })

  const setPlatformBlock = (mode: '7d' | '30d' | 'forever' | 'off') => {
    if (mode === 'off') {
      setIsBlocked(false)
      setBlockedUntil('')
      onSave({
        username: username.trim(),
        isBlocked: false,
        blockReason: blockReason.trim(),
        blockedUntil: null,
      })
      return
    }

    const until = mode === 'forever' ? '' : dayjs().add(mode === '7d' ? 7 : 30, 'day').format('YYYY-MM-DDTHH:mm')
    setIsBlocked(true)
    setBlockedUntil(until)
    onSave({
      username: username.trim(),
      isBlocked: true,
      blockReason: blockReason.trim(),
      blockedUntil: until || null,
    })
  }

  const setRegistrationBan = (mode: '7d' | '30d' | 'forever' | 'off') => {
    if (mode === 'off') {
      setMatchBanUntil('')
      onSave({
        username: username.trim(),
        matchBanUntil: null,
      })
      return
    }

    const until = mode === 'forever' ? dayjs().add(20, 'year').format('YYYY-MM-DDTHH:mm') : dayjs().add(mode === '7d' ? 7 : 30, 'day').format('YYYY-MM-DDTHH:mm')
    setMatchBanUntil(until)
    onSave({
      username: username.trim(),
      matchBanUntil: until,
    })
  }

  const platformBlocked = isBlocked && (!blockedUntil || dayjs(blockedUntil).isAfter(dayjs()))
  const registrationBan = Boolean(matchBanUntil && dayjs(matchBanUntil).isAfter(dayjs()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="small-label">Профиль</div>
        <h3 style={{ margin: '4px 0 10px' }}>{user.name || user.username || user.email}</h3>
        <div className="small-label">ID: {user.id}</div>
        <div className="small-label">Email: {user.email}</div>
        <div className="small-label">Ник: {user.username || '—'}</div>
        <div className="small-label">Имя: {user.firstName || '—'} {user.lastName || ''}</div>
        <div className="small-label">Город: {user.city?.name || '—'}</div>
        <div className="small-label">Роль: {user.role}</div>
        <div className="small-label">Зарегистрирован: {formatDate(user.createdAt)}</div>
        <div className="small-label">Обновлен: {formatDate(user.updatedAt)}</div>
        <div className="small-label">Команд: {user.memberships?.length ?? 0}</div>
        <div className="small-label">Капитан: {user.captainedTeams?.length ?? 0}</div>
        <div className="actions-row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
          <span className="badge" style={{ background: platformBlocked ? '#ef4444' : '#e5e7eb', color: platformBlocked ? '#fff' : '#111827' }}>
            {platformBlocked ? `Блок${blockedUntil ? ` до ${formatDate(blockedUntil)}` : ' навсегда'}` : 'Без платформенного блока'}
          </span>
          <span className="badge" style={{ background: registrationBan ? '#f59e0b' : '#e5e7eb', color: '#111827' }}>
            {registrationBan ? `Бан заявок до ${formatDate(matchBanUntil)}` : 'Заявки разрешены'}
          </span>
        </div>
      </div>

      <div>
        <div className="form-section-title">Никнейм</div>
        <div className="actions-row">
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} style={{ flex: 1 }} />
          <button className="button" type="button" disabled={isSaving} onClick={saveProfile}>
            Сохранить ник
          </button>
        </div>
      </div>

      <div>
        <div className="form-section-title">Платформенный блок</div>
        <div className="actions-row" style={{ flexWrap: 'wrap' }}>
          <button className="button button-danger" type="button" disabled={isSaving} onClick={() => setPlatformBlock('7d')}>
            На 7 дней
          </button>
          <button className="button button-danger" type="button" disabled={isSaving} onClick={() => setPlatformBlock('30d')}>
            На 30 дней
          </button>
          <button className="button button-danger" type="button" disabled={isSaving} onClick={() => setPlatformBlock('forever')}>
            Навсегда
          </button>
          <button className="button button-muted" type="button" disabled={isSaving} onClick={() => setPlatformBlock('off')}>
            Снять блок
          </button>
        </div>
      </div>

      <div>
        <div className="form-section-title">Причина блокировки</div>
        <textarea className="textarea" rows={3} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Например: оскорбления, спам, фейковая регистрация" />
      </div>

      <div>
        <div className="form-section-title">Запрет на заявки</div>
        <div className="actions-row" style={{ flexWrap: 'wrap' }}>
          <button className="button" type="button" disabled={isSaving} onClick={() => setRegistrationBan('7d')}>
            На 7 дней
          </button>
          <button className="button" type="button" disabled={isSaving} onClick={() => setRegistrationBan('30d')}>
            На 30 дней
          </button>
          <button className="button" type="button" disabled={isSaving} onClick={() => setRegistrationBan('forever')}>
            Очень долго
          </button>
          <button className="button button-muted" type="button" disabled={isSaving} onClick={() => setRegistrationBan('off')}>
            Снять запрет
          </button>
        </div>
      </div>

      <div className="actions-row">
        <button
          className="button"
          type="button"
          disabled={isSaving}
          onClick={saveProfile}
        >
          Сохранить все вручную
        </button>
        <button
          className="button button-muted"
          type="button"
          disabled={isSaving}
          onClick={() =>
            onSave({
              isBlocked: false,
              blockReason: '',
              blockedUntil: null,
              matchBanUntil: null,
            })
          }
        >
          Снять все ограничения
        </button>
        <button
          className="button button-muted"
          type="button"
          disabled={isSaving}
          onClick={() => setShowManualDates((value) => !value)}
        >
          {showManualDates ? 'Скрыть даты' : 'Ручные даты'}
        </button>
      </div>

      {showManualDates && (
        <>
          <div>
            <div className="form-section-title">Блок до</div>
            <input className="datetime" type="datetime-local" value={blockedUntil} onChange={(e) => setBlockedUntil(e.target.value)} />
          </div>

          <div>
            <div className="form-section-title">Запрет на заявки до</div>
            <input className="datetime" type="datetime-local" value={matchBanUntil} onChange={(e) => setMatchBanUntil(e.target.value)} />
          </div>
        </>
      )}
    </div>
  )
}

const formatDate = (value?: string | null) => (value ? dayjs(value).format('DD.MM.YYYY HH:mm') : '—')

const toLocalInput = (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DDTHH:mm') : '')

const isPlatformBlocked = (user: User) =>
  Boolean(
    user.isBlocked &&
      (!user.blockedUntil || dayjs(user.blockedUntil).isAfter(dayjs()))
  )

const isMatchBanned = (user: User) =>
  Boolean(user.matchBanUntil && dayjs(user.matchBanUntil).isAfter(dayjs()))

export default UsersPage

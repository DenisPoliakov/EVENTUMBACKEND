import { useMemo, useState } from 'react'
import { useCrmOverview } from '../api/hooks'
import type { CrmClient, CrmClientStatus, CrmCoach, CrmClub } from '../types'
import Select from '../components/Select'

const statusLabels: Record<CrmClientStatus, string> = {
  NEW: 'Новый',
  ACTIVE: 'Активный',
  VIP: 'VIP',
  AT_RISK: 'Риск ухода',
  NEEDS_ATTENTION: 'Нужна реакция',
  BLOCKED: 'Блок',
}

const statusOptions = [
  { value: '', label: 'Все статусы' },
  { value: 'NEEDS_ATTENTION', label: 'Нужна реакция' },
  { value: 'AT_RISK', label: 'Риск ухода' },
  { value: 'VIP', label: 'VIP' },
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'NEW', label: 'Новые' },
  { value: 'BLOCKED', label: 'Блок' },
]

function CrmPage() {
  const [sportCode, setSportCode] = useState('ALL')
  const { data, isLoading } = useCrmOverview(sportCode)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const clients = data?.clients || []
  const filteredClients = useMemo(() => {
    const query = q.trim().toLowerCase()
    return clients.filter((client) => {
      const matchesStatus = status ? client.status === status : true
      const haystack = [client.name, client.username, client.email, client.phone, client.city?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return matchesStatus && (!query || haystack.includes(query))
    })
  }, [clients, q, status])

  const selectedClient =
    filteredClients.find((client) => client.id === selectedClientId) || filteredClients[0] || clients[0] || null

  if (isLoading) {
    return (
      <div className="panel">
        <div className="small-label">CRM загружается</div>
      </div>
    )
  }

  return (
    <div className="crm-page">
      <div className="section-header crm-header">
        <div>
          <div className="small-label">Единый центр работы с клиентами</div>
          <h2 style={{ margin: '4px 0 0' }}>CRM EVENTUM</h2>
        </div>
        <div className="crm-header-meta">
          <span>{data?.sports.find((sport) => sport.code === sportCode)?.name || 'Все направления'}</span>
          <span>{data?.summary.clientsTotal || 0} клиентов</span>
          <span>{data?.summary.pendingRegistrations || 0} заявок ждут</span>
        </div>
      </div>

      <div className="panel crm-sport-panel">
        <div>
          <div className="small-label">Разделение по спорту</div>
          <h3>Направления</h3>
        </div>
        <div className="crm-sport-tabs">
          {(data?.sports || [{ code: 'ALL', name: 'Все направления' }]).map((sport) => {
            const breakdown = data?.sportBreakdown.find((item) => item.code === sport.code)
            return (
              <button
                key={sport.code}
                type="button"
                className={`crm-sport-tab ${sport.code === sportCode ? 'active' : ''}`}
                onClick={() => {
                  setSportCode(sport.code)
                  setSelectedClientId(null)
                }}
              >
                <strong>{sport.name}</strong>
                {sport.code !== 'ALL' && breakdown ? (
                  <span>
                    {breakdown.clients} клиентов · {breakdown.coaches} тренеров
                    {breakdown.clubs ? ` · ${breakdown.clubs} клубов` : ''}
                  </span>
                ) : (
                  <span>общий обзор</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="crm-kpi-grid">
        <Kpi title="Клиенты" value={data?.summary.clientsTotal || 0} detail={`+${data?.summary.newClientsWeek || 0} за неделю`} />
        <Kpi title="Активность" value={data?.summary.activeClientsMonth || 0} detail="активны за 30 дней" />
        <Kpi title="Заявки" value={data?.summary.pendingRegistrations || 0} detail="ждут модерации" tone="warning" />
        <Kpi title="Абонементы" value={data?.summary.activeSubscriptions || 0} detail={`${data?.summary.expiringSubscriptions || 0} истекают`} />
        <Kpi title="Выручка" value={formatMoney(data?.summary.revenue.amountCents || 0, data?.summary.revenue.currency || 'RUB')} detail="по абонементам" />
        <Kpi title="Клубы" value={data?.summary.clubs || 0} detail="площадки и залы" />
        <Kpi title="Тренеры" value={data?.summary.coaches || 0} detail="профили в CRM" />
        <Kpi title="Матчи" value={data?.summary.matchesNeedTeams || 0} detail="нужны команды" tone="warning" />
      </div>

      <div className="crm-workbench">
        <div className="crm-left">
          <div className="panel">
            <div className="crm-panel-title">
              <div>
                <div className="small-label">Очередь внимания</div>
                <h3>Что обработать сейчас</h3>
              </div>
            </div>
            <div className="crm-attention-grid">
              <AttentionList
                title="Заявки"
                empty="Новых заявок нет"
                items={(data?.attention.pendingRegistrations || []).map((registration) => ({
                  id: registration.id,
                  title: registration.teamName,
                  meta: `${registration.captainName} · ${registration.match?.stadium?.name || 'Матч'}`,
                  badge: 'PENDING',
                }))}
              />
              <AttentionList
                title="Истекают"
                empty="Продлений пока нет"
                items={(data?.attention.expiringSubscriptions || []).map((subscription) => ({
                  id: subscription.id,
                  title: subscription.user?.username || subscription.user?.name || 'Клиент',
                  meta: `${subscription.plan?.title || 'Абонемент'} · до ${formatDate(subscription.expiresAt)}`,
                  badge: subscription.status,
                }))}
              />
              <AttentionList
                title="Недобор"
                empty="Матчи заполнены"
                items={(data?.attention.matchesNeedTeams || []).map((match) => ({
                  id: match.id,
                  title: match.stadium?.name || 'Матч',
                  meta: `${formatDate(match.startTime)} · свободно ${match.emptySlots}`,
                  badge: match.status,
                }))}
              />
            </div>
          </div>

          <div className="panel">
            <div className="crm-panel-title">
              <div>
                <div className="small-label">Клубная сеть</div>
                <h3>Клубы, залы и продажи</h3>
              </div>
            </div>
            <div className="crm-club-grid">
              {(data?.clubs || []).length ? (
                (data?.clubs || []).map((club) => <ClubCard key={club.id} club={club} />)
              ) : (
                <div className="small-label">В этом направлении клубов пока нет</div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="crm-panel-title">
              <div>
                <div className="small-label">Тренерский состав</div>
                <h3>Тренеры и подопечные</h3>
              </div>
            </div>
            <div className="crm-coach-grid">
              {(data?.coaches || []).length ? (
                (data?.coaches || []).map((coach) => <CoachCard key={coach.id} coach={coach} />)
              ) : (
                <div className="small-label">В этом направлении тренеров пока нет</div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="crm-toolbar">
              <div>
                <div className="small-label">Клиентская база</div>
                <h3>Клиенты и сегменты</h3>
              </div>
              <div className="crm-filters">
                <input
                  className="input"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Поиск по имени, телефону, email"
                />
                <Select value={status} onChange={setStatus} options={statusOptions} placeholder="Все статусы" />
              </div>
            </div>

            <div className="crm-client-list">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  className={`crm-client-row ${selectedClient?.id === client.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => setSelectedClientId(client.id)}
                >
                  <div>
                    <div className="crm-client-name">{client.username || client.name}</div>
                    <div className="small-label">{client.email}</div>
                  </div>
                  <div className="crm-client-metrics">
                    <span className={`crm-status crm-status-${client.status.toLowerCase()}`}>{statusLabels[client.status]}</span>
                    <span>{client.stats.registrations} заявок</span>
                    <span>{client.stats.activeSubscriptions} абон.</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="crm-right">
          <ClientCard client={selectedClient} />
        </div>
      </div>
    </div>
  )
}

function ClubCard({ club }: { club: CrmClub }) {
  const contacts = [club.contactPhone, club.contactEmail, club.websiteUrl, club.telegramUrl].filter(Boolean)

  return (
    <div className="crm-club-card">
      <div className="crm-club-media">
        {club.imageUrl ? <img src={club.imageUrl} alt="" /> : <span>{club.name.slice(0, 1)}</span>}
      </div>
      <div className="crm-club-content">
        <div className="crm-club-head">
          <div>
            <strong>{club.name}</strong>
            <p>{[club.kind, club.city, club.sport?.name].filter(Boolean).join(' · ') || club.address}</p>
          </div>
          <em>{formatMoney(club.stats.revenue.amountCents, club.stats.revenue.currency)}</em>
        </div>

        <div className="crm-next-action crm-club-action">
          <div className="small-label">Следующее действие</div>
          <strong>{club.nextAction}</strong>
        </div>

        <div className="crm-club-stats">
          <Fact label="Активные" value={club.stats.activeSubscriptions} />
          <Fact label="Избранное" value={club.stats.favoriteUsers} />
          <Fact label="Тренеры" value={club.stats.coaches} />
          <Fact label="Расписание" value={club.stats.schedules} />
        </div>

        <div className="crm-club-lines">
          <span>{club.address}</span>
          <span>{contacts.length ? contacts.join(' · ') : 'Контакты не указаны'}</span>
          <span>
            {club.stats.activePlans} активных планов · {club.stats.expiringSubscriptions} продлений на неделе
          </span>
        </div>

        <div className="crm-club-subgrid">
          <div>
            <h4>Тренеры</h4>
            {club.coaches.length ? (
              club.coaches.map((coach) => <span key={coach.id}>{coach.name}</span>)
            ) : (
              <span>Не назначены</span>
            )}
          </div>
          <div>
            <h4>Ближайшие слоты</h4>
            {club.schedules.length ? (
              club.schedules.map((schedule) => (
                <span key={schedule.id}>
                  {formatWeekday(schedule.dayOfWeek)} {schedule.startTime}-{schedule.endTime}
                </span>
              ))
            ) : (
              <span>Расписание пустое</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CoachCard({ coach }: { coach: CrmCoach }) {
  return (
    <div className="crm-coach-card">
      <div className="crm-coach-avatar">
        {coach.photoUrl ? <img src={coach.photoUrl} alt="" /> : <span>{coach.name.slice(0, 1) || 'T'}</span>}
      </div>
      <div className="crm-coach-body">
        <div className="crm-coach-head">
          <div>
            <strong>{coach.name || coach.username || 'Тренер'}</strong>
            <p>{coach.club?.name || 'Клуб не привязан'}</p>
          </div>
          <em>{coach.club?.sport?.name || 'Спорт'}</em>
        </div>
        <div className="crm-coach-meta">
          <span>{coach.club?.city || 'Город не указан'}</span>
          <span>{coach.experienceYears ? `${coach.experienceYears} лет опыта` : 'Опыт не указан'}</span>
        </div>
        {coach.description && <p className="crm-coach-description">{coach.description}</p>}
        <div className="crm-coach-stats">
          <Fact label="Активные" value={coach.stats.activeStudents} />
          <Fact label="Всего" value={coach.stats.totalStudents} />
          <Fact label="Потенциал" value={coach.stats.prospects} />
          <Fact label="Чаты" value={coach.stats.chats} />
        </div>
      </div>
    </div>
  )
}

function formatWeekday(value?: number | null) {
  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  if (value === null || value === undefined) return 'День'
  return labels[value - 1] || labels[value] || 'День'
}

function Kpi({ title, value, detail, tone }: { title: string; value: string | number; detail: string; tone?: 'warning' }) {
  return (
    <div className={`crm-kpi ${tone === 'warning' ? 'warning' : ''}`}>
      <div className="small-label">{title}</div>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  )
}

function AttentionList({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: Array<{ id: string; title: string; meta: string; badge: string }>
}) {
  return (
    <div className="crm-attention-list">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <div className="small-label">{empty}</div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="crm-attention-item">
            <div>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
            </div>
            <em>{item.badge}</em>
          </div>
        ))
      )}
    </div>
  )
}

function ClientCard({ client }: { client: CrmClient | null }) {
  if (!client) {
    return (
      <div className="panel">
        <div className="small-label">Клиент не выбран</div>
      </div>
    )
  }

  return (
    <div className="panel crm-client-card">
      <div className="crm-client-top">
        <div>
          <div className="small-label">Карточка клиента</div>
          <h3>{client.username || client.name}</h3>
          <p>{client.email}</p>
        </div>
        <span className={`crm-status crm-status-${client.status.toLowerCase()}`}>{statusLabels[client.status]}</span>
      </div>

      <div className="crm-next-action">
        <div className="small-label">Следующее действие</div>
        <strong>{client.nextAction}</strong>
      </div>

      <div className="crm-client-facts">
        <Fact label="Город" value={client.city?.name || 'Не указан'} />
        <Fact label="Телефон" value={client.phone || 'Не указан'} />
        <Fact label="Последняя активность" value={client.lastActivityAt ? formatDate(client.lastActivityAt) : 'Нет данных'} />
        <Fact label="Регистрация" value={formatDate(client.createdAt)} />
      </div>

      <div className="crm-segments">
        {client.segments.length ? client.segments.map((segment) => <span key={segment}>{segment}</span>) : <span>Без сегментов</span>}
      </div>

      <div className="crm-mini-stats">
        <Fact label="Заявки" value={client.stats.registrations} />
        <Fact label="Приняты" value={client.stats.approvedRegistrations} />
        <Fact label="Команды" value={client.stats.teams} />
        <Fact label="Клубы" value={client.stats.favoriteClubs} />
      </div>

      <div className="crm-card-section">
        <h4>История</h4>
        <div className="crm-timeline">
          {client.activity.map((item) => (
            <div key={item.id} className="crm-timeline-item">
              <span />
              <div>
                <strong>{item.title}</strong>
                <p>{item.meta || 'Событие CRM'}</p>
                <em>{formatDate(item.at)}</em>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="crm-card-section">
        <h4>Последние абонементы</h4>
        {client.subscriptions.length ? (
          client.subscriptions.map((subscription) => (
            <div key={subscription.id} className="crm-compact-row">
              <span>{subscription.plan?.title || 'Абонемент'}</span>
              <em>{subscription.status}</em>
            </div>
          ))
        ) : (
          <div className="small-label">Абонементов нет</div>
        )}
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default CrmPage

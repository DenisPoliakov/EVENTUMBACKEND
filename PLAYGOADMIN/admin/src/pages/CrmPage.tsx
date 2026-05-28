import { useMemo, useState } from 'react'
import { useCrmOverview } from '../api/hooks'
import type { CrmClient, CrmClientStatus } from '../types'
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
  const { data, isLoading } = useCrmOverview()
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
          <span>{data?.summary.clientsTotal || 0} клиентов</span>
          <span>{data?.summary.pendingRegistrations || 0} заявок ждут</span>
        </div>
      </div>

      <div className="crm-kpi-grid">
        <Kpi title="Клиенты" value={data?.summary.clientsTotal || 0} detail={`+${data?.summary.newClientsWeek || 0} за неделю`} />
        <Kpi title="Активность" value={data?.summary.activeClientsMonth || 0} detail="активны за 30 дней" />
        <Kpi title="Заявки" value={data?.summary.pendingRegistrations || 0} detail="ждут модерации" tone="warning" />
        <Kpi title="Абонементы" value={data?.summary.activeSubscriptions || 0} detail={`${data?.summary.expiringSubscriptions || 0} истекают`} />
        <Kpi title="Выручка" value={formatMoney(data?.summary.revenue.amountCents || 0, data?.summary.revenue.currency || 'RUB')} detail="по абонементам" />
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

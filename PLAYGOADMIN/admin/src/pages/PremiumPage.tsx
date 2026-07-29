import dayjs from 'dayjs'

import { usePremiumOverview } from '../api/hooks'

function PremiumPage() {
  const { data } = usePremiumOverview()

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="small-label">Платформа</div>
          <h2 style={{ margin: '4px 0 0' }}>EVENTUM Premium</h2>
        </div>
      </div>

      <div className="panel">
        <h3>Тарифы</h3>
        <table className="table">
          <thead><tr><th>Тариф</th><th>Цена</th><th>Срок</th><th>Статус</th></tr></thead>
          <tbody>
            {data?.plans.map((plan) => (
              <tr key={plan.id}>
                <td>{plan.title}<br /><span className="small-label">{plan.code}</span></td>
                <td>{(plan.priceCents / 100).toFixed(2)} {plan.currency}</td>
                <td>{plan.durationDays} дней</td>
                <td>{plan.isActive ? 'Активен' : 'Отключён'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Оплаченные подписки</h3>
        <table className="table">
          <thead><tr><th>Пользователь</th><th>Начало</th><th>Окончание</th><th>Сумма</th><th>Статус</th></tr></thead>
          <tbody>
            {data?.subscriptions.map((subscription) => (
              <tr key={subscription.id}>
                <td>{subscription.user?.username || subscription.user?.email || subscription.userId}</td>
                <td>{dayjs(subscription.startsAt).format('DD.MM.YYYY HH:mm')}</td>
                <td>{dayjs(subscription.expiresAt).format('DD.MM.YYYY HH:mm')}</td>
                <td>{(subscription.amountCents / 100).toFixed(2)} {subscription.currency}</td>
                <td>{dayjs(subscription.expiresAt).isAfter(dayjs()) ? subscription.status : 'EXPIRED'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PremiumPage

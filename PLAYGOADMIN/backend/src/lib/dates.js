const moscowFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const moscowDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export const formatHumanDateTimeRu = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return moscowFormatter.format(date)
}

export const formatHumanDateRu = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return moscowDateFormatter.format(date)
}

export const parseBirthDate = (raw) => {
  if (raw === undefined) return { skipped: true }
  if (raw === null || raw === '') return { value: null }

  const text = String(raw).trim()
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  let date
  if (isoDateOnly) {
    const year = Number(isoDateOnly[1])
    const month = Number(isoDateOnly[2])
    const day = Number(isoDateOnly[3])
    date = new Date(Date.UTC(year, month - 1, day))
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return { error: 'birthDate is invalid' }
    }
  } else {
    date = new Date(text)
    if (Number.isNaN(date.getTime())) return { error: 'birthDate is invalid' }
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  }

  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (date > todayUtc) return { error: 'birthDate cannot be in the future' }

  const min = new Date(Date.UTC(todayUtc.getUTCFullYear() - 120, todayUtc.getUTCMonth(), todayUtc.getUTCDate()))
  if (date < min) return { error: 'birthDate is too far in the past' }

  return { value: date }
}

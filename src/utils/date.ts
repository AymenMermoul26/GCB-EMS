export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const now = Date.now()
  const diffMs = date.getTime() - now
  const absMs = Math.abs(diffMs)

  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const weekMs = 7 * dayMs

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (absMs < hourMs) {
    const minutes = Math.round(diffMs / minuteMs)
    return rtf.format(minutes, 'minute')
  }

  if (absMs < dayMs) {
    const hours = Math.round(diffMs / hourMs)
    return rtf.format(hours, 'hour')
  }

  if (absMs < weekMs) {
    const days = Math.round(diffMs / dayMs)
    return rtf.format(days, 'day')
  }

  const weeks = Math.round(diffMs / weekMs)
  return rtf.format(weeks, 'week')
}

export const useRelativeDate = () => {
  const { t, locale } = useI18n()

  const formatRelativeDate = (date: string | Date) => {
    const now = new Date()
    const messageDate = new Date(date)
    const diffInMs = now.getTime() - messageDate.getTime()
    const diffInHours = diffInMs / (1000 * 60 * 60)

    if (diffInHours < 24) {
      const hours = Math.floor(diffInHours)
      if (hours <= 0) return t('time.justNow')
      if (hours === 1) return t('time.oneHourAgo')
      return t('time.hoursAgo', { count: hours })
    } else {
      const days = Math.floor(diffInHours / 24)
      if (days === 1) return t('time.oneDayAgo')
      return t('time.daysAgo', { count: days })
    }
  }

  const formatSessionDate = (date: string | Date) => {
    const now = new Date()
    const d = new Date(date)

    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()

    if (isToday) {
      return d.toLocaleTimeString(locale.value, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    }

    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 30) {
      if (diffDays <= 1) return t('time.oneDayAgo')
      return t('time.daysAgo', { count: diffDays })
    }

    return d.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
  }

  return { formatRelativeDate, formatSessionDate }
}

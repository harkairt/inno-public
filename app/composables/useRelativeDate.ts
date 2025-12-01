export const useRelativeDate = () => {
  const { t } = useI18n()

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

  return { formatRelativeDate }
}

export function sanitizeFileUrl(url: string, apiBaseUrl = ''): string {
  if (!url) return ''

  if (url.startsWith('/') && !url.startsWith('//')) {
    const base = apiBaseUrl.replace(/\/+$/, '')
    return base ? `${base}${url}` : url
  }

  try {
    const parsed = new URL(url)
    if (
      parsed.protocol === 'blob:' ||
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:'
    ) {
      return url
    }
  } catch {
    /* invalid URL */
  }

  return ''
}

export function sanitizeFileUrl(url: string): string {
  if (!url) return ''

  if (url.startsWith('/') && !url.startsWith('//')) return url

  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url
  } catch {
    /* invalid URL */
  }

  return ''
}

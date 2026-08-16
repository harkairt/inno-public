export function getInitials(name?: string | null): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (words.length === 0) return ''
  if (words.length === 1) return words[0]!.slice(0, 2)
  return `${words[0]![0]}${words.at(-1)![0]}`
}

function emailToHue(email: string): number {
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash)
  }
  return ((hash % 360) + 360) % 360
}

export function getAvatarStyle(email: string): { backgroundColor: string; color: string } {
  const hue = emailToHue(email)
  return {
    backgroundColor: `hsl(${hue}, 55%, 82%)`,
    color: `hsl(${hue}, 45%, 28%)`,
  }
}

export function hasAvatar(image?: string | null): boolean {
  if (!image) return false
  return !image.includes('profilePlaceholder')
}

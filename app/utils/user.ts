/**
 * Get initials from a user's name for avatar display
 * @param name - Full name or email address
 * @returns Uppercase initials (max 2 characters)
 * @example getInitials("John Doe") => "JD"
 * @example getInitials("alice@example.com") => "AL"
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 45%, 55%)`
}

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

export function getUserFriendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

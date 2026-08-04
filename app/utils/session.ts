import type { AISessionHeaderDTO } from '@/types/api/schemas'

export function getSessionActivityDate(
  session: Pick<AISessionHeaderDTO, 'insertDate' | 'modifiedAt'>,
): string {
  return session.modifiedAt ?? session.insertDate
}

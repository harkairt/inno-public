import type { AISessionMessageDTO, UserDTO } from '@/types/api/schemas'

export interface WelcomeAgent {
  agentId: number
  agentName: string
  firstMessageDate: string | undefined
}

/**
 * Resolve the virtual agent for the welcome greeting of a 1:1 agent chat.
 * Returns null unless the session has exactly 2 members and exactly one of them is a virtual
 * agent present in `selectableUsers`. Purely member-based, so the result is stable across the
 * placeholder (session header), the synthetic send cache, and the authoritative GetSessionById
 * payload — the welcome no longer vanishes when GetSessionById replaces the cache.
 */
export function resolveWelcomeAgent(
  members: string[] | undefined,
  selectableUsers: UserDTO[] | undefined,
  messages: AISessionMessageDTO[] | undefined | null,
  insertDate: string | undefined,
): WelcomeAgent | null {
  if (members?.length !== 2 || !selectableUsers) return null
  const virtualMembers = selectableUsers.filter((u) => u.isVirtual && members.includes(u.email))
  if (virtualMembers.length !== 1) return null
  const agent = virtualMembers[0]!
  return {
    agentId: agent.id,
    agentName: agent.name,
    firstMessageDate: messages?.[0]?.sendDate ?? insertDate,
  }
}

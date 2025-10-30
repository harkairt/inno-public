import type { SignalRService } from './SignalRService'

/**
 * SignalR hub operations - encapsulates all server method invocations
 */
export class SignalROperations {
  private service: SignalRService

  constructor(service: SignalRService) {
    this.service = service
  }

  /**
   * Notify session members about a new message
   * @param memberEmails - Array of member email addresses to notify
   * @param sessionId - The session ID
   * @param agentId - The agent ID
   */
  notifyMessageSent(memberEmails: string[], sessionId: string, agentId: number): void {
    if (!memberEmails.length) return

    this.service.send('SendMessageToUser', memberEmails, sessionId, agentId)
  }
}

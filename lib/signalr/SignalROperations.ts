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
   * @param userIds - Array of user IDs (emails) to notify
   * @param sessionId - The session ID
   * @param agentId - The agent ID
   */
  notifyMessageSent(userIds: string[], sessionId: string, agentId: number): void {
    if (!userIds.length) return

    void this.service.send('SendMessageToUser', userIds, sessionId, agentId)
  }

  /**
   * Notify session members that a user started typing
   * @param memberEmails - Array of member email addresses to notify
   * @param name - Name of the user who started typing
   * @param email - Email of the user who started typing
   * @param sessionId - The session ID
   */
  sendStartTypingInfo(
    memberEmails: string[],
    name: string,
    email: string,
    sessionId: string,
  ): void {
    if (!memberEmails.length) return

    void this.service.send('SendStartTypingInfo', memberEmails, name, email, sessionId)
  }

  /**
   * Notify session members that a user stopped typing
   * @param memberEmails - Array of member email addresses to notify
   * @param name - Name of the user who stopped typing
   * @param email - Email of the user who stopped typing
   * @param sessionId - The session ID
   */
  sendStopTypingInfo(memberEmails: string[], name: string, email: string, sessionId: string): void {
    if (!memberEmails.length) return

    void this.service.send('SendStopTypingInfo', memberEmails, name, email, sessionId)
  }
}

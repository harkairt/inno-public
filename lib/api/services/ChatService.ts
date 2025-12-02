import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import { normalizeApiError } from '@/lib/errors/normalize'
import { AppError } from '@/lib/errors/types'
import type {
  AiQuestionRequestDTO,
  AISessionHeaderDTO,
  AISessionDTO,
  AISessionMessageDTO,
  AIWelcomeMessageDTO,
  GetSessionByIdRequestDTO,
  GetSessionHeadersByUserIdRequestDTO,
  SetSessionNameRequestDTO,
  DeleteSessionByIdrequestDTO,
  SetSessionMessageRatingRequestDTO,
  GetUnreadMessagesRequestDTO,
  GetUnreadMessagesDTO,
  AddUserToSessionRequestDTO,
  RemoveUserFromSessionRequestDTO,
} from '@/types/api/schemas'
import type { SessionStats } from '@/types/api/admin-types'
import {
  AISessionHeaderDTOSchema,
  AISessionMessageDTOSchema,
  AISessionDTOSchema,
  AIWelcomeMessageDTOSchema,
  GetUnreadMessagesDTOSchema,
  validateMutationSuccess,
} from '@/types/api/schemas'
import type { ApiResponse, MutationSuccess } from '@/types/api/base'
import { ErrorCode } from '@/types/enums'

export class ChatService {
  /**
   * Send text question to AI
   */
  async sendQuestion(
    request: AiQuestionRequestDTO,
  ): Promise<Result<AISessionMessageDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AISessionMessageDTO>>(
        '/api/AIWebAPI/question/text',
        request,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.EMPTY_RESPONSE, 'No response from AI'))
      }

      // Validate response with Zod
      const parseResult = AISessionMessageDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid AI response format',
          undefined,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Send option selection to AI
   */
  async sendOption(
    request: AiQuestionRequestDTO,
  ): Promise<Result<AISessionMessageDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AISessionMessageDTO>>(
        '/api/AIWebAPI/QuestionOption',
        request,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.EMPTY_RESPONSE, 'No response from AI'))
      }

      // Validate response with Zod
      const parseResult = AISessionMessageDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid AI response format',
          undefined,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get welcome message for agent
   */
  async getWelcomeMessage(
    request: AiQuestionRequestDTO,
  ): Promise<Result<AIWelcomeMessageDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AIWelcomeMessageDTO>>(
        '/api/AIWebAPI/welcomeText',
        request,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.EMPTY_RESPONSE, 'No welcome message'))
      }

      // Validate response with Zod
      const parseResult = AIWelcomeMessageDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid welcome message format',
          undefined,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get all sessions for user (headers only, without messages)
   */
  async getSessionHeaders(
    request: GetSessionHeadersByUserIdRequestDTO,
  ): Promise<Result<AISessionHeaderDTO[], AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AISessionHeaderDTO[]>>(
        '/api/AIWebAPI/GetSessionHeadersByUserId',
        request,
      )

      const sessions = response.data.data || []

      // Validate each session header with Zod (no messages)
      const validatedSessions: AISessionHeaderDTO[] = []
      for (const session of sessions) {
        const parseResult = AISessionHeaderDTOSchema.safeParse(session)
        if (!parseResult.success) {
          return err(new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid session header data format',
            undefined,
            parseResult.error,
          ))
        }
        validatedSessions.push(parseResult.data)
      }

      return ok(validatedSessions)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get session by ID with all messages
   */
  async getSessionById(
    sessionId: string,
  ): Promise<Result<AISessionDTO, AppError>> {
    try {
      const request: GetSessionByIdRequestDTO = {
        sessionId,
        agentId: 1,
      }

      const response = await apiClient.post<ApiResponse<AISessionDTO>>(
        '/api/AIWebAPI/GetSessionById',
        request,
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'Session not found'))
      }

      // Validate response with Zod
      const parseResult = AISessionDTOSchema.safeParse(response.data.data)

      if (!parseResult.success) {
        return err(new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid session data format',
          undefined,
          parseResult.error,
        ))
      }

      return ok(parseResult.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Update session name
   * Backend returns: { data: "{\"message\":\"kész.\"}" }
   * @returns MutationSuccess (true) on successful operation
   */
  async updateSessionName(
    request: SetSessionNameRequestDTO,
  ): Promise<Result<MutationSuccess, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<string>>(
        '/api/AIWebAPI/SetSessionName',
        request,
      )

      return validateMutationSuccess(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Delete session
   * @returns MutationSuccess (true) on successful operation
   */
  async deleteSession(
    request: DeleteSessionByIdrequestDTO,
  ): Promise<Result<MutationSuccess, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<string>>(
        '/api/AIWebAPI/DeleteSessionById',
        request,
      )
      return validateMutationSuccess(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Rate message (thumbs up/down)
   */
  async rateMessage(
    request: SetSessionMessageRatingRequestDTO,
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/AIWebAPI/SetSessionMessageRating', request)
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Mark messages as read/unread
   */
  async markMessagesRead(
    sessionId: string,
    agentId: number,
    userCode: string,
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/AIWebAPI/Set_SessionMessagesRead', {
        sessionID: sessionId,
        agent: agentId,
        userCode,
      })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get unread message counts across all sessions
   */
  async getUnreadMessages(
    request: GetUnreadMessagesRequestDTO,
  ): Promise<Result<GetUnreadMessagesDTO[], AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<GetUnreadMessagesDTO[]>>(
        '/api/AIWebAPI/GetUnreadMessages',
        request,
      )

      const unreadMessages = response.data.data || []

      // Validate each unread message entry with Zod
      const validatedUnreadMessages = []
      for (const unreadMsg of unreadMessages) {
        const parseResult = GetUnreadMessagesDTOSchema.safeParse(unreadMsg)
        if (!parseResult.success) {
          return err(new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid unread message data format',
            undefined,
            parseResult.error,
          ))
        }
        validatedUnreadMessages.push(parseResult.data)
      }

      return ok(validatedUnreadMessages)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * React to message (emoji/reaction)
   */
  async reactToMessage(
    sessionId: string,
    messageId: string,
    agentId: number,
    reaction: string,
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/AIWebAPI/react', {
        sessionId,
        messageId,
        agentId,
        reaction,
      })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Add user to session
   */
  async addUserToSession(
    request: AddUserToSessionRequestDTO,
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/AIWebAPI/addUserToSession', request)
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Remove user from session
   */
  async removeUserFromSession(
    request: RemoveUserFromSessionRequestDTO,
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/AIWebAPI/removeUserFromSession', request)
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(
    sessionId: string,
    agentId: number,
  ): Promise<Result<SessionStats, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<SessionStats>>(
        '/api/AIWebAPI/Get_SessionStats',
        {
          sessionId,
          agentId,
        },
      )

      if (!response.data.data) {
        return err(new AppError(ErrorCode.NOT_FOUND, 'Session statistics not found'))
      }

      return ok(response.data.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Export session data
   */
  async exportSession(
    sessionId: string,
    agentId: number,
    format: 'json' | 'csv' | 'pdf' = 'json',
  ): Promise<Result<Blob, AppError>> {
    try {
      const response = await apiClient.post(
        '/api/AIWebAPI/Export_Session',
        {
          sessionId,
          agentId,
          format,
        },
        {
          responseType: 'blob',
        },
      )

      return ok(response.data)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Search messages in session
   */
  async searchMessages(
    sessionId: string,
    agentId: number,
    query: string,
    limit: number = 50,
  ): Promise<Result<AISessionMessageDTO[], AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AISessionMessageDTO[]>>(
        '/api/AIWebAPI/Search_Messages',
        {
          sessionId,
          agentId,
          query,
          limit,
        },
      )

      const messages = response.data.data || []

      // Validate each message with Zod
      const validatedMessages = []
      for (const message of messages) {
        const parseResult = AISessionMessageDTOSchema.safeParse(message)
        if (!parseResult.success) {
          return err(new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid message data format',
            undefined,
            parseResult.error,
          ))
        }
        validatedMessages.push(parseResult.data)
      }

      return ok(validatedMessages)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  /**
   * Forward message to another session
   */
  async forwardMessage(
    fromSessionId: string,
    fromAgentId: number,
    toSessionId: string,
    toAgentId: number,
    messageId: string,
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/AIWebAPI/Forward_Message', {
        fromSessionId,
        fromAgentId,
        toSessionId,
        toAgentId,
        messageId,
      })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }
}

// Singleton
export const chatService = new ChatService()
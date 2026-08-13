import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { apiClient } from '../client'
import {
  validateApiResponse,
  validateApiArray,
  requireData,
  validateMutationSuccess,
} from '../validation'
import { normalizeApiError } from '@/lib/errors/normalize'
import type { AppError } from '@/lib/errors/types'
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
  GetMessageRequestDTO,
  GetSessionUnreadMessagesRequestDTO,
  StartPublicChatrequestDTO,
  AIPublicChatStartDTO,
  UploadFileResponseDTO,
} from '@/types/api/schemas'
import {
  AISessionHeaderDTOSchema,
  AISessionMessageDTOSchema,
  AISessionDTOSchema,
  AIWelcomeMessageDTOSchema,
  GetUnreadMessagesDTOSchema,
  AIPublicChatStartDTOSchema,
  UploadFileResponseDTOSchema,
} from '@/types/api/schemas'
import type { ApiResponse, MutationSuccess } from '@/types/api/base'
import { ErrorCode } from '@/types/enums'

class ChatService {
  async uploadFile(
    agentId: number,
    sessionId: string,
    file: File,
    onProgress: (percent: number) => void,
  ): Promise<Result<UploadFileResponseDTO, AppError>> {
    try {
      const formData = new FormData()
      formData.append('agentId', String(agentId))
      formData.append('sessionId', sessionId)
      formData.append('file', file)

      const response = await apiClient.post<ApiResponse<UploadFileResponseDTO>>(
        '/api/AIWebAPI/uploadFile',
        formData,
        {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
            }
          },
        },
      )

      const dataResult = requireData(
        response.data.data,
        ErrorCode.UPLOAD_ERROR,
        'No upload response data',
      )
      if (dataResult.isErr()) return dataResult

      return validateApiResponse(
        dataResult.value,
        UploadFileResponseDTOSchema,
        'Invalid upload response format',
      )
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async sendQuestion(
    request: AiQuestionRequestDTO,
  ): Promise<Result<AISessionMessageDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AISessionMessageDTO>>(
        '/api/AIWebAPI/question/text',
        request,
      )

      const dataResult = requireData(
        response.data.data,
        ErrorCode.EMPTY_RESPONSE,
        'No response from AI',
      )
      if (dataResult.isErr()) return dataResult

      return validateApiResponse(
        dataResult.value,
        AISessionMessageDTOSchema,
        'Invalid AI response format',
      )
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async getWelcomeMessage(
    request: AiQuestionRequestDTO,
  ): Promise<Result<AIWelcomeMessageDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AIWelcomeMessageDTO>>(
        '/api/AIWebAPI/welcomeText',
        request,
      )

      const dataResult = requireData(
        response.data.data,
        ErrorCode.EMPTY_RESPONSE,
        'No welcome message',
      )
      if (dataResult.isErr()) return dataResult

      return validateApiResponse(
        dataResult.value,
        AIWelcomeMessageDTOSchema,
        'Invalid welcome message format',
      )
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async getSessionHeaders(
    request: GetSessionHeadersByUserIdRequestDTO,
  ): Promise<Result<AISessionHeaderDTO[], AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AISessionHeaderDTO[]>>(
        '/api/AIWebAPI/GetSessionHeadersByUserId',
        request,
      )

      return validateApiArray(
        response.data.data,
        AISessionHeaderDTOSchema,
        'Invalid session header data format',
      )
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async getSessionById(sessionId: string): Promise<Result<AISessionDTO, AppError>> {
    try {
      const request: GetSessionByIdRequestDTO = { sessionId, agentId: 1 }

      const response = await apiClient.post<ApiResponse<AISessionDTO>>(
        '/api/AIWebAPI/GetSessionById',
        request,
      )

      const dataResult = requireData(response.data.data, ErrorCode.NOT_FOUND, 'Session not found')
      if (dataResult.isErr()) return dataResult

      return validateApiResponse(
        dataResult.value,
        AISessionDTOSchema,
        'Invalid session data format',
      )
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

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

  async rateMessage(request: SetSessionMessageRatingRequestDTO): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/AIWebAPI/SetSessionMessageRating', request)
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

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

  async getUnreadMessages(
    request: GetUnreadMessagesRequestDTO,
  ): Promise<Result<GetUnreadMessagesDTO[], AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<GetUnreadMessagesDTO[]>>(
        '/api/AIWebAPI/GetUnreadMessages',
        request,
      )

      return validateApiArray(
        response.data.data,
        GetUnreadMessagesDTOSchema,
        'Invalid unread message data format',
      )
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async reactToMessage(
    sessionId: string,
    messageId: string,
    agentId: number,
  ): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/AIWebAPI/react', { sessionId, messageId, agentId })
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async addUserToSession(request: AddUserToSessionRequestDTO): Promise<Result<void, AppError>> {
    try {
      await apiClient.post('/api/AIWebAPI/addUserToSession', request)
      return ok(undefined)
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

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

  async getMessage(request: GetMessageRequestDTO): Promise<Result<AISessionMessageDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AISessionMessageDTO>>(
        '/api/AIWebAPI/getMessage',
        request,
      )

      const dataResult = requireData(response.data.data, ErrorCode.NOT_FOUND, 'Message not found')
      if (dataResult.isErr()) return dataResult

      return validateApiResponse(
        dataResult.value,
        AISessionMessageDTOSchema,
        'Invalid message data format',
      )
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async getSessionUnreadMessages(
    request: GetSessionUnreadMessagesRequestDTO,
  ): Promise<Result<number, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<number>>(
        '/api/AIWebAPI/GetSessionUnreadMessages',
        request,
      )

      return requireData(response.data.data, ErrorCode.EMPTY_RESPONSE, 'No unread count returned')
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }

  async startPublicChat(
    request: StartPublicChatrequestDTO,
  ): Promise<Result<AIPublicChatStartDTO, AppError>> {
    try {
      const response = await apiClient.post<ApiResponse<AIPublicChatStartDTO>>(
        '/api/AIWebAPI/startPublicChat',
        request,
      )

      const dataResult = requireData(
        response.data.data,
        ErrorCode.EMPTY_RESPONSE,
        'No public chat data returned',
      )
      if (dataResult.isErr()) return dataResult

      return validateApiResponse(
        dataResult.value,
        AIPublicChatStartDTOSchema,
        'Invalid public chat data format',
      )
    } catch (error) {
      return err(normalizeApiError(error))
    }
  }
}

// Singleton
export const chatService = new ChatService()

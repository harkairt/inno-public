import type { Result } from 'neverthrow'
import { err } from 'neverthrow'
import { z } from 'zod'
import { apiClient } from '../client'
import { requireData, validateApiResponse } from '../validation'
import { safePost, safePostArray, safeMutation, safeVoid } from './safeRequest'
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

const UnreadCountSchema = z.number()

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

  sendQuestion(request: AiQuestionRequestDTO): Promise<Result<AISessionMessageDTO, AppError>> {
    return safePost({
      url: '/api/AIWebAPI/question/text',
      body: request,
      schema: AISessionMessageDTOSchema,
      errorCode: ErrorCode.EMPTY_RESPONSE,
      errorMessage: 'No response from AI',
    })
  }

  getWelcomeMessage(request: AiQuestionRequestDTO): Promise<Result<AIWelcomeMessageDTO, AppError>> {
    return safePost({
      url: '/api/AIWebAPI/welcomeText',
      body: request,
      schema: AIWelcomeMessageDTOSchema,
      errorCode: ErrorCode.EMPTY_RESPONSE,
      errorMessage: 'No welcome message',
    })
  }

  getSessionHeaders(
    request: GetSessionHeadersByUserIdRequestDTO,
  ): Promise<Result<AISessionHeaderDTO[], AppError>> {
    return safePostArray(
      '/api/AIWebAPI/GetSessionHeadersByUserId',
      request,
      AISessionHeaderDTOSchema,
      'Invalid session header data format',
    )
  }

  getSessionById(sessionId: string): Promise<Result<AISessionDTO, AppError>> {
    const request: GetSessionByIdRequestDTO = { sessionId, agentId: 1 }
    return safePost({
      url: '/api/AIWebAPI/GetSessionById',
      body: request,
      schema: AISessionDTOSchema,
      errorCode: ErrorCode.NOT_FOUND,
      errorMessage: 'Session not found',
    })
  }

  updateSessionName(request: SetSessionNameRequestDTO): Promise<Result<MutationSuccess, AppError>> {
    return safeMutation('/api/AIWebAPI/SetSessionName', request)
  }

  deleteSession(request: DeleteSessionByIdrequestDTO): Promise<Result<MutationSuccess, AppError>> {
    return safeMutation('/api/AIWebAPI/DeleteSessionById', request)
  }

  rateMessage(request: SetSessionMessageRatingRequestDTO): Promise<Result<void, AppError>> {
    return safeVoid('/api/AIWebAPI/SetSessionMessageRating', request)
  }

  markMessagesRead(
    sessionId: string,
    agentId: number,
    userCode: string,
  ): Promise<Result<void, AppError>> {
    return safeVoid('/api/AIWebAPI/Set_SessionMessagesRead', {
      sessionID: sessionId,
      agent: agentId,
      userCode,
    })
  }

  getUnreadMessages(
    request: GetUnreadMessagesRequestDTO,
  ): Promise<Result<GetUnreadMessagesDTO[], AppError>> {
    return safePostArray(
      '/api/AIWebAPI/GetUnreadMessages',
      request,
      GetUnreadMessagesDTOSchema,
      'Invalid unread message data format',
    )
  }

  reactToMessage(
    sessionId: string,
    messageId: string,
    agentId: number,
  ): Promise<Result<void, AppError>> {
    return safeVoid('/api/AIWebAPI/react', { sessionId, messageId, agentId })
  }

  addUserToSession(request: AddUserToSessionRequestDTO): Promise<Result<void, AppError>> {
    return safeVoid('/api/AIWebAPI/addUserToSession', request)
  }

  removeUserFromSession(request: RemoveUserFromSessionRequestDTO): Promise<Result<void, AppError>> {
    return safeVoid('/api/AIWebAPI/removeUserFromSession', request)
  }

  getMessage(request: GetMessageRequestDTO): Promise<Result<AISessionMessageDTO, AppError>> {
    return safePost({
      url: '/api/AIWebAPI/getMessage',
      body: request,
      schema: AISessionMessageDTOSchema,
      errorCode: ErrorCode.NOT_FOUND,
      errorMessage: 'Message not found',
    })
  }

  getSessionUnreadMessages(
    request: GetSessionUnreadMessagesRequestDTO,
  ): Promise<Result<number, AppError>> {
    return safePost({
      url: '/api/AIWebAPI/GetSessionUnreadMessages',
      body: request,
      schema: UnreadCountSchema,
      errorCode: ErrorCode.EMPTY_RESPONSE,
      errorMessage: 'No unread count returned',
    })
  }

  startPublicChat(
    request: StartPublicChatrequestDTO,
  ): Promise<Result<AIPublicChatStartDTO, AppError>> {
    return safePost({
      url: '/api/AIWebAPI/startPublicChat',
      body: request,
      schema: AIPublicChatStartDTOSchema,
      errorCode: ErrorCode.EMPTY_RESPONSE,
      errorMessage: 'No public chat data returned',
    })
  }
}

export const chatService = new ChatService()

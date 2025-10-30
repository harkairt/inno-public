import { z } from 'zod'

export enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum MessageType {
  USER_QUESTION = 'USER_QUESTION',
  SYSTEM_RESPONSE = 'SYSTEM_RESPONSE',
}

export const MessageSchema = z.object({
  messageId: z.string().uuid(),
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string().min(1).max(10000).trim(),
  timestamp: z.coerce.date(),
  status: z.nativeEnum(MessageStatus),
  messageType: z.nativeEnum(MessageType),
})

export type Message = z.infer<typeof MessageSchema>
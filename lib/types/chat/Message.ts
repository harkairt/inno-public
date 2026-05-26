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
  messageId: z.uuid(),
  sessionId: z.uuid(),
  userId: z.uuid(),
  content: z.string().min(1).max(10000).trim(),
  timestamp: z.coerce.date(),
  status: z.enum(MessageStatus),
  messageType: z.enum(MessageType),
})

export type Message = z.infer<typeof MessageSchema>

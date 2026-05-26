import { z } from 'zod'

export const ChatSessionSchema = z
  .object({
    sessionId: z.uuid(),
    userId: z.uuid(),
    sessionName: z.string().min(1).max(255).trim(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    messageCount: z.number().int().nonnegative(),
  })
  .refine((data) => data.updatedAt >= data.createdAt, {
    message: 'updatedAt must be >= createdAt',
    path: ['updatedAt'],
  })

export type ChatSession = z.infer<typeof ChatSessionSchema>

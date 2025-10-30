import { describe, it, expect } from 'vitest'
import { validateMessage } from '../validateMessage'
import { MessageStatus, MessageType } from '@/lib/types/chat'

describe('validateMessage', () => {
  it('should validate a correct message', () => {
    const validMessage = {
      messageId: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      content: 'Hello, world!',
      timestamp: new Date(),
      status: MessageStatus.SENT,
      messageType: MessageType.USER_QUESTION,
    }

    const result = validateMessage(validMessage)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.content).toBe('Hello, world!')
      expect(result.value.status).toBe(MessageStatus.SENT)
    }
  })

  it('should reject message with invalid UUID', () => {
    const invalidMessage = {
      messageId: 'invalid-uuid',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      content: 'Hello, world!',
      timestamp: new Date(),
      status: MessageStatus.SENT,
      messageType: MessageType.USER_QUESTION,
    }

    const result = validateMessage(invalidMessage)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.validationErrors).toHaveLength(1)
      expect(result.error.validationErrors[0].field).toBe('messageId')
      expect(result.error.validationErrors[0].message).toContain('valid')
    }
  })

  it('should reject message with empty content', () => {
    const invalidMessage = {
      messageId: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      content: '',
      timestamp: new Date(),
      status: MessageStatus.SENT,
      messageType: MessageType.USER_QUESTION,
    }

    const result = validateMessage(invalidMessage)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.validationErrors).toHaveLength(1)
      expect(result.error.validationErrors[0].field).toBe('content')
      expect(result.error.validationErrors[0].message).toContain('empty')
    }
  })

  it('should reject message with missing required fields', () => {
    const incompleteMessage = {
      messageId: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      // Missing userId, content, timestamp, status, messageType
    }

    const result = validateMessage(incompleteMessage)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.validationErrors.length).toBeGreaterThan(0)
      const fieldNames = result.error.validationErrors.map(e => e.field)
      expect(fieldNames).toContain('userId')
      expect(fieldNames).toContain('content')
    }
  })
})
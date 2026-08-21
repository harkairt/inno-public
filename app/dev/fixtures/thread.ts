import type { AISessionMessageDTO, OptionsMessagePayload, UserDTO } from '@/types/api/schemas'
import { AIAnswerType, OptionsUIControlType } from '@/types/enums'
import { salesRows } from '@/app/dev/fixtures/tabular'

export const galleryUser: UserDTO = {
  id: 4242,
  createdAt: '2026-01-02T08:00:00.000Z',
  updatedAt: null,
  name: 'Gallery User',
  email: 'gallery@innochat.dev',
  status: 'active',
  invitationAccepted: true,
  roles: ['user'],
  isVirtual: false,
  url: null,
  image: null,
  darkImage: null,
  userIds: [],
  users: null,
  isAvailable: true,
}

const AGENT_CODE = 'innochat-agent'
const AGENT_NAME = 'InnoChat Agent'
const SESSION_ID = 'dev-gallery-session'
const DAY_MS = 86_400_000

const at = (dayOffset: number, hour: number, minute: number): string => {
  const date = new Date(Date.now() + dayOffset * DAY_MS)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const answeredPayload: OptionsMessagePayload = {
  Text: 'Which report would you like?',
  MultiSelectEnabled: false,
  IsPlainTextEnabled: false,
  UIControlType: OptionsUIControlType.RadioButton,
  Items: [
    { Key: 'k1', Value: '**Revenue** by region' },
    { Key: 'k2', Value: 'Renewals with `signedAt` breakdown' },
    { Key: 'k3', Value: 'Both' },
  ],
}

const activePayload: OptionsMessagePayload = {
  Text: 'Anything else to include? Select all that apply.',
  MultiSelectEnabled: true,
  IsPlainTextEnabled: false,
  UIControlType: OptionsUIControlType.RadioButton,
  Items: [
    { Key: 'k1', Value: 'Quarter-over-quarter chart' },
    { Key: 'k2', Value: 'Raw rows as an attachment' },
    { Key: 'k3', Value: 'A short *written* summary' },
  ],
}

const agentMessage = (
  messageID: string,
  sendDate: string,
  messageText: string,
  messageType: AIAnswerType = AIAnswerType.Text,
): AISessionMessageDTO => ({
  isRated: false,
  rating: null,
  readByUsers: [],
  messageID,
  messageText,
  messageType,
  sendDate,
  senderName: AGENT_NAME,
  senderUserCode: AGENT_CODE,
  sessionId: SESSION_ID,
})

const userMessage = (
  messageID: string,
  sendDate: string,
  messageText: string,
): AISessionMessageDTO => ({
  isRated: false,
  rating: null,
  readByUsers: [],
  messageID,
  messageText,
  messageType: AIAnswerType.Text,
  sendDate,
  senderName: galleryUser.name,
  senderUserCode: galleryUser.email,
  sessionId: SESSION_ID,
})

export const ACTIVE_OPTIONS_MESSAGE_ID = 'msg-7'

export const threadMessages: AISessionMessageDTO[] = [
  agentMessage(
    'msg-1',
    at(-1, 9, 12),
    'Good morning! I can pull together the **Q1 numbers** for you. What would help most?',
  ),
  userMessage('msg-2', at(-1, 9, 13), 'The regional sales table, please.'),
  agentMessage(
    'msg-3',
    at(-1, 9, 15),
    'Here it is:\n\n```rows\n' + JSON.stringify(salesRows, null, 2) + '\n```',
  ),
  agentMessage('msg-4', at(0, 10, 2), JSON.stringify(answeredPayload), AIAnswerType.Options),
  userMessage('msg-5', at(0, 10, 3), 'Renewals with `signedAt` breakdown'),
  agentMessage('msg-6', at(0, 10, 4), 'Noted — renewals it is.'),
  agentMessage(
    ACTIVE_OPTIONS_MESSAGE_ID,
    at(0, 10, 5),
    JSON.stringify(activePayload),
    AIAnswerType.Options,
  ),
]

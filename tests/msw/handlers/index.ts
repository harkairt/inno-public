import { authHandlers } from './auth'
import { chatHandlers } from './chat'
import { configHandlers } from './config'
import { userHandlers } from './user'
import { logHandlers } from './log'

export const handlers = [
  ...authHandlers,
  ...chatHandlers,
  ...configHandlers,
  ...userHandlers,
  ...logHandlers,
]

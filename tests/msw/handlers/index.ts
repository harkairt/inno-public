import { authHandlers } from './auth'
import { chatHandlers } from './chat'
import { configHandlers } from './config'
import { fileUploadHandlers } from './fileUpload'
import { userHandlers } from './user'
import { logHandlers } from './log'

export const handlers = [
  ...authHandlers,
  ...chatHandlers,
  ...configHandlers,
  ...fileUploadHandlers,
  ...userHandlers,
  ...logHandlers,
]

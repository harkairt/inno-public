import { http } from 'msw'
import { apiOk, mutationOk } from '../http'
import { makeSession, makeRawMessage, makeUser } from '../../utils/factories'

// All chat endpoints are POST under /api/AIWebAPI/ (verified against ChatService.ts).
// Default dataset is intentionally tiny — per-test overrides supply scenario data.
// Messages use makeRawMessage() so the wire messageType is the lowercase string
// the backend sends (AISessionMessageDTOSchema transforms it to the enum on parse).
export const chatHandlers = [
  http.post('/api/AIWebAPI/question/text', () => apiOk(makeRawMessage())),
  http.post('/api/AIWebAPI/welcomeText', () => apiOk({ message: 'Welcome' })),
  http.post('/api/AIWebAPI/GetSessionHeadersByUserId', () => apiOk([makeSession()])),
  http.post('/api/AIWebAPI/GetSessionById', () =>
    apiOk({ ...makeSession(), messages: [makeRawMessage()] }),
  ),
  http.post('/api/AIWebAPI/SetSessionName', () => mutationOk()),
  http.post('/api/AIWebAPI/DeleteSessionById', () => mutationOk()),
  http.post('/api/AIWebAPI/SetSessionMessageRating', () => apiOk(null)),
  http.post('/api/AIWebAPI/Set_SessionMessagesRead', () => apiOk(null)),
  http.post('/api/AIWebAPI/GetUnreadMessages', () =>
    apiOk([{ sessionId: 'session-1', unreadMessageCount: 0 }]),
  ),
  http.post('/api/AIWebAPI/GetSessionUnreadMessages', () => apiOk(0)),
  http.post('/api/AIWebAPI/react', () => apiOk(null)),
  http.post('/api/AIWebAPI/addUserToSession', () => apiOk(null)),
  http.post('/api/AIWebAPI/removeUserFromSession', () => apiOk(null)),
  http.post('/api/AIWebAPI/getMessage', () => apiOk(makeRawMessage())),
  http.post('/api/AIWebAPI/startPublicChat', () => apiOk({ user: makeUser(), agent: makeUser() })),
]

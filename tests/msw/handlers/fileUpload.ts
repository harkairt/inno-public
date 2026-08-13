import { http } from 'msw'
import { apiOk } from '../http'

export const fileUploadHandlers = [
  http.post('/api/AIWebAPI/uploadFile', () =>
    apiOk({
      id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
      mimeType: 'image/png',
      thumbnailUrl: '',
    }),
  ),
]

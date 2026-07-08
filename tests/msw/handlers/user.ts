import { http } from 'msw'
import { apiOk } from '../http'
import { makeUser } from '../../utils/factories'

// UserService.getSelectableUsers uses GET with an ?email query param.
export const userHandlers = [
  http.get('/api/user/get-selectable-users', () => apiOk([makeUser(), makeUser()])),
]

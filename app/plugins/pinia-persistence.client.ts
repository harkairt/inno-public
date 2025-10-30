import { createPersistedState } from 'pinia-plugin-persistedstate'

export default defineNuxtPlugin(() => {
  const pinia = usePinia()
  pinia.use(createPersistedState({
    storage: localStorage,
  }))
})

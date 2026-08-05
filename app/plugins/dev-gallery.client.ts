import { useAuthStore } from '@/app/stores/auth'
import { galleryUser } from '@/app/dev/fixtures/thread'

/**
 * Seeds an in-memory user for `/dev/*` so `auth.global.ts` does not bounce the
 * component gallery to `/login`, and so own-vs-partner message alignment renders.
 * In-memory only: the auth store persists solely through explicit save calls, so
 * this never touches the developer's real session in storage.
 */
export default defineNuxtPlugin({
  name: 'dev-gallery',
  setup() {
    if (!import.meta.dev) return
    if (!window.location.pathname.includes('/dev/')) return

    useAuthStore().user = galleryUser
  },
})

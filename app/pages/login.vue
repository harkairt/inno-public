<template>
  <div
    class="bg-[hsl(var(--card))] dark:bg-[hsl(var(--card))] rounded-xl p-8 sm:p-10"
    style="box-shadow: var(--shadow-lg)"
  >
    <div class="text-center mb-8">
      <h1 class="font-display text-3xl font-bold text-[hsl(var(--foreground))]">
        {{ t('login.title') }}
      </h1>
      <p class="text-[hsl(var(--muted-foreground))] mt-2">{{ t('login.subtitle') }}</p>
    </div>

    <form
      class="space-y-6"
      @submit.prevent="handleLogin"
    >
      <!-- Email Field -->
      <div>
        <label
          for="email"
          class="block text-sm font-medium text-[hsl(var(--foreground))] mb-2"
        >
          {{ t('login.email') }}
        </label>
        <UInput
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          size="lg"
          :placeholder="t('login.emailPlaceholder')"
          class="w-full"
        />
      </div>

      <!-- Password Field -->
      <div>
        <label
          for="password"
          class="block text-sm font-medium text-[hsl(var(--foreground))] mb-2"
        >
          {{ t('login.password') }}
        </label>
        <div class="relative">
          <UInput
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            autocomplete="current-password"
            size="lg"
            :placeholder="t('login.passwordPlaceholder')"
            class="w-full"
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors"
            @click="showPassword = !showPassword"
          >
            <UIcon
              v-if="showPassword"
              name="i-heroicons-eye-slash"
              class="size-5"
            />
            <UIcon
              v-else
              name="i-heroicons-eye"
              class="size-5"
            />
          </button>
        </div>
      </div>

      <!-- Remember Me -->
      <div class="flex items-center">
        <UCheckbox
          id="remember"
          v-model="rememberMe"
          :label="t('login.rememberMe')"
        />
      </div>

      <!-- Error Message -->
      <UAlert
        v-if="loginError"
        color="error"
        variant="soft"
        :title="loginError"
        icon="i-heroicons-exclamation-circle"
        data-testid="login-error"
      />

      <!-- Submit Button -->
      <UButton
        type="submit"
        :disabled="isLoggingIn"
        :loading="isLoggingIn"
        color="primary"
        variant="solid"
        size="lg"
        block
        class="font-medium"
      >
        <span v-if="isLoggingIn">{{ t('login.signingIn') }}</span>
        <span v-else>{{ t('login.signIn') }}</span>
      </UButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useLogin } from '@/app/composables/useAuth'
import { AuthenticationMode } from '@/types/enums'
import { getRememberedEmail, saveRememberedEmail, clearRememberedEmail } from '~/stores/auth'

definePageMeta({
  layout: 'auth',
})

const { t } = useI18n()
const config = useRuntimeConfig()

// Check for remembered email first, then fall back to dev credentials
const rememberedEmail = getRememberedEmail()
const email = ref(rememberedEmail ?? config.public.devLoginEmail ?? '')
const password = ref(config.public.devLoginPassword ?? '')
const showPassword = ref(false)
// Pre-check "Remember Me" if email was remembered
const rememberMe = ref<boolean | 'indeterminate'>(!!rememberedEmail)
const loginError = ref<string | null>(null)

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

// Use the login composable
const { mutate: login, isPending: isLoggingIn } = useLogin()

const handleLogin = async () => {
  loginError.value = null

  login(
    { email: email.value, password: password.value, mode: AuthenticationMode.Basic },
    {
      onSuccess: () => {
        // Save or clear remembered email based on checkbox
        if (rememberMe.value) {
          saveRememberedEmail(email.value)
        } else {
          clearRememberedEmail()
        }
        // Redirect to the intended page or home
        const redirect = (route.query.redirect as string) || '/'
        const safeRedirect =
          redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('://')
            ? redirect
            : '/'
        void router.push(safeRedirect)
      },
      onError: (error: unknown) => {
        loginError.value = error instanceof Error ? error.message : t('login.invalidCredentials')
      },
    },
  )
}

// If already authenticated, redirect to home
onMounted(() => {
  if (authStore.isAuthenticated) {
    const redirect = (route.query.redirect as string) || '/'
    const safeRedirect =
      redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('://')
        ? redirect
        : '/'
    void router.push(safeRedirect)
  }

  // Sync dev credentials after hydration (fixes SSR/client mismatch)
  if (!email.value && config.public.devLoginEmail) {
    email.value = config.public.devLoginEmail
  }
  if (!password.value && config.public.devLoginPassword) {
    password.value = config.public.devLoginPassword
  }
})
</script>

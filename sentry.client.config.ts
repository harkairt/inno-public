import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: useRuntimeConfig().public.sentryDsn,
  release: `innochat@${useRuntimeConfig().public.buildVersion}`,

  sendDefaultPii: true,

  // Performance: sample 20% of transactions in production
  tracesSampleRate: import.meta.dev ? 1.0 : 0.2,

  // Session Replay: capture 10% of sessions, 100% on error
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

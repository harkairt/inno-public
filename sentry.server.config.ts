import * as Sentry from '@sentry/nuxt'

Sentry.init({
  // Use process.env because useRuntimeConfig() isn't available yet at server init
  dsn: process.env.NUXT_PUBLIC_SENTRY_DSN,

  // Performance: sample 20% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.2,
})

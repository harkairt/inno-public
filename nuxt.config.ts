// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  ssr: false,

  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      link: [
        // Google Fonts: Plus Jakarta Sans (headings) + Inter (body)
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap'
        }
      ],
      meta: [
        // Critical for Android keyboard: tells browser to resize content when keyboard appears
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, interactive-widget=resizes-content'
        }
      ]
    }
  },

  css: ['./app/assets/css/main.css'],

  modules: [
    '@vite-pwa/nuxt',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/icon',
    '@nuxt/test-utils',
    '@nuxtjs/i18n'
  ],

  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'hu', name: 'Hungarian', file: 'hu.json' }
    ],
    defaultLocale: 'hu',
    strategy: 'no_prefix',
    langDir: 'locales',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'hu'
    }
  },

  colorMode: {
    preference: 'light',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'nuxt-color-mode',
  },

  sourcemap: {
    server: true,
    client: true,
  },

  pinia: {
    storesDirs: ['./app/stores/**'],
  },

  // Path aliases - @ points to project root, ~ points to app directory
  alias: {
    '@': fileURLToPath(new URL('.', import.meta.url)),
  },

  components: {
    dirs: [
      {
        path: '~/components',
        extensions: ['.vue'],
      }
    ]
  },

  typescript: {
    strict: true,
    typeCheck: true
  },

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8082',
      devLoginEmail: '',
    },
  },

  // PWA Configuration
  pwa: {
    registerType: 'autoUpdate',

    workbox: {
      navigateFallback: undefined,
      globPatterns: ['**/*.{js,css,html,png,svg,ico,txt}'],
      skipWaiting: true,
      clientsClaim: true,

      runtimeCaching: [
        {
          urlPattern: /^https:\/\/api\./i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 // 24 hours
            }
          }
        },
        {
          urlPattern: /.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
            }
          }
        }
      ]
    },

    client: {
      installPrompt: true,
      periodicSyncForUpdates: 60 * 60 // 1 hour
    },

    manifest: {
      name: 'Vonno - AI Chat Platform',
      short_name: 'Vonno',
      description: 'Intelligent AI-powered chat platform for seamless communication',
      theme_color: '#283618',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      scope: process.env.NUXT_APP_BASE_URL || '/',
      start_url: process.env.NUXT_APP_BASE_URL || '/',
      icons: [
        {
          src: 'icons/icon-72x72.png',
          sizes: '72x72',
          type: 'image/png'
        },
        {
          src: 'icons/icon-96x96.png',
          sizes: '96x96',
          type: 'image/png'
        },
        {
          src: 'icons/icon-128x128.png',
          sizes: '128x128',
          type: 'image/png'
        },
        {
          src: 'icons/icon-144x144.png',
          sizes: '144x144',
          type: 'image/png'
        },
        {
          src: 'icons/icon-152x152.png',
          sizes: '152x152',
          type: 'image/png'
        },
        {
          src: 'icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'icons/icon-384x384.png',
          sizes: '384x384',
          type: 'image/png'
        },
        {
          src: 'icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ],
      categories: ['productivity', 'business', 'utilities'],
      shortcuts: [
        {
          name: 'New Chat',
          short_name: 'Chat',
          description: 'Start a new chat session',
          url: '/chat/new',
          icons: [{ src: 'icons/chat-96x96.png', sizes: '96x96', type: 'image/png' }]
        },
        {
          name: 'History',
          short_name: 'History',
          description: 'View chat history',
          url: '/history',
          icons: [{ src: 'icons/history-96x96.png', sizes: '96x96', type: 'image/png' }]
        }
      ]
    }
  },

  vite: {
    // Vite configuration for production

    // Optimization for production
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'vue-router', 'pinia'],
            query: ['@tanstack/vue-query'],
            signalr: ['@microsoft/signalr'],
            utils: ['axios', 'neverthrow', 'zod']
          }
        }
      }
    },
    plugins: [
      tailwindcss(),
    ],
  },

  // Development optimizations
  nitro: {
    esbuild: {
      options: {
        target: 'esnext'
      }
    },
    // Enable debug logging for proxy requests
    logLevel: 4, // 0: silent, 1: error, 2: warn, 3: info, 4: verbose
  },

  // Route rules for API proxy (works in both dev and production)
  routeRules: {
    '/api/**': {
      proxy: `${process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8082'}/api/**`
    },
    '/chatHub/**': {
      proxy: `${process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8082'}/chatHub/**`
    },
    '/assets/**': {
      proxy: `${process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8082'}/assets/**`
    }
  }
})
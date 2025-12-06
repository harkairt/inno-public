# Build & Deployment

This document provides comprehensive documentation of the build system, deployment configuration, and DevOps setup.

---

## 1. NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `nuxt dev` | Start development server |
| `build` | `nuxt build` | Production build |
| `generate` | `nuxt generate` | Static site generation |
| `preview` | `nuxt preview` | Preview production build |
| `postinstall` | `nuxt prepare` | Prepare Nuxt (auto-run) |
| `typecheck` | `nuxi typecheck` | TypeScript type checking |
| `lint` | `eslint .` | Run ESLint |
| `lint:fix` | `eslint . --fix` | Fix lint issues |
| `analyze` | `vue-tsc` | Type analysis |
| `test` | `vitest` | Unit tests (watch mode) |
| `test:run` | `vitest run` | Unit tests (single run) |
| `test:coverage` | `vitest run --coverage` | Unit tests with coverage |
| `test:e2e` | `playwright test` | E2E tests |

---

## 2. Build Configuration

### 2.1 Vite Settings

**File:** `nuxt.config.ts` → `vite`

| Setting | Value |
|---------|-------|
| Sourcemaps | Enabled (client + server) |
| Target | `esnext` |

### 2.2 Code Splitting

```typescript
// nuxt.config.ts
vite: {
  build: {
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
  }
}
```

### 2.3 Output Structure

```
.output/
├── public/
│   ├── _nuxt/
│   │   ├── vendor.[hash].js
│   │   ├── query.[hash].js
│   │   ├── signalr.[hash].js
│   │   ├── utils.[hash].js
│   │   └── [page-chunks].[hash].js
│   └── [static-assets]
└── server/
    └── [server-chunks]
```

---

## 3. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NUXT_APP_BASE_URL` | `/` | Base URL for routing |
| `NUXT_PUBLIC_API_BASE_URL` | (empty) | API base URL for production |
| `NUXT_PROXY_TARGET` | `http://localhost:8082` | Dev proxy target |

### 3.1 Usage in Code

```typescript
// Access runtime config
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
```

### 3.2 .env Files

```bash
# .env.local (development)
NUXT_PROXY_TARGET=http://localhost:8082

# .env.production
NUXT_PUBLIC_API_BASE_URL=https://api.vonno.com
NUXT_APP_BASE_URL=/app/
```

---

## 4. API Proxy Configuration

### 4.1 Development Proxy (Nitro)

**File:** `nuxt.config.ts`

```typescript
routeRules: {
  '/api/**': {
    proxy: `${process.env.NUXT_PROXY_TARGET || 'http://localhost:8082'}/api/**`
  },
  '/chatHub/**': {
    proxy: `${process.env.NUXT_PROXY_TARGET || 'http://localhost:8082'}/chatHub/**`
  },
  '/assets/**': {
    proxy: `${process.env.NUXT_PROXY_TARGET || 'http://localhost:8082'}/assets/**`
  }
}
```

### 4.2 Production

- No proxy needed
- Direct API calls to configured `NUXT_PUBLIC_API_BASE_URL`
- CORS configured on backend

---

## 5. PWA Configuration

### 5.1 Workbox Settings

**File:** `nuxt.config.ts` → `pwa`

| Setting | Value |
|---------|-------|
| Register type | `prompt` |
| Skip waiting | Yes |
| Clients claim | Yes |

### 5.2 Caching Strategies

| Pattern | Strategy | TTL |
|---------|----------|-----|
| API (`/api/`) | NetworkFirst | 24 hours |
| Images | CacheFirst | 30 days |
| Static | CacheFirst | N/A |

```typescript
pwa: {
  workbox: {
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
  }
}
```

### 5.3 Periodic Sync

- Interval: 10 minutes
- Checks for app updates
- Prompts user when update available

### 5.4 PWA Manifest

```typescript
manifest: {
  name: 'Vonno - AI Chat Platform',
  short_name: 'Vonno',
  description: 'Intelligent AI-powered chat platform',
  theme_color: '#283618',
  background_color: '#ffffff',
  display: 'standalone',
  orientation: 'portrait'
}
```

---

## 6. TypeScript Configuration

**File:** `tsconfig.json`

```json
{
  "extends": "./.nuxt/tsconfig.json",
  "compilerOptions": {
    "strict": true
  }
}
```

### 6.1 Strict Mode

- `strict: true` enables all strict type checks
- `typeCheck: true` in nuxt.config.ts enables build-time checks

---

## 7. ESLint Configuration

**File:** `eslint.config.mjs`

```javascript
import nuxtEslint from '@nuxt/eslint'

export default nuxtEslint({
  rules: {
    // Vue rules
    'vue/multi-word-component-names': 'off',

    // TypeScript rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off'
  }
})
```

---

## 8. Deployment Checklist

### 8.1 Pre-deployment

- [ ] Run `npm run typecheck`
- [ ] Run `npm run lint`
- [ ] Run `npm run test:run`
- [ ] Run `npm run build`
- [ ] Test with `npm run preview`

### 8.2 Environment Setup

- [ ] Configure `NUXT_PUBLIC_API_BASE_URL`
- [ ] Configure `NUXT_APP_BASE_URL` if not at root
- [ ] Enable CORS on backend for frontend domain

### 8.3 Post-deployment

- [ ] Verify PWA manifest loads
- [ ] Test SignalR connection
- [ ] Verify API calls work
- [ ] Test authentication flow

---

## 9. Docker Support (Optional)

### 9.1 Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.output .output
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

### 9.2 Docker Compose

```yaml
version: '3.8'
services:
  vonno:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NUXT_PUBLIC_API_BASE_URL=http://backend:8082
```

---

## 10. Performance Optimization

### 10.1 Bundle Analysis

```bash
# Analyze bundle size
npx nuxi analyze
```

### 10.2 Image Optimization

- Use WebP format
- Lazy load images
- Specify dimensions

### 10.3 Code Splitting

- Route-based splitting (automatic)
- Dynamic imports for heavy components
- Manual chunks for vendor libraries

---

## Related Documentation

- [TESTING.md](./TESTING.md) - Test configuration
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Project structure

# Netlify Edge Functions Setup for CORS Proxy

This guide explains how to deploy the Netlify Edge Function to act as a CORS proxy for API requests while keeping the main site on GitHub Pages.

## Prerequisites

- GitHub account with the `vonno` repository
- No credit card required for Netlify free tier

## Setup Steps

### 1. Create Netlify Account

1. Go to [netlify.com](https://netlify.com)
2. Click "Sign Up"
3. Choose "Sign up with GitHub" (easiest option)
4. Authorize Netlify to access your GitHub repositories
5. **No credit card required** ✓

### 2. Import Your Repository

1. In Netlify dashboard, click "Add new site" → "Import an existing project"
2. Choose "Deploy with GitHub"
3. Authorize Netlify to access `vonno` repository
4. Select the `vonno` repository

### 3. Configure Build Settings

**IMPORTANT:** We're only deploying edge functions, not the site itself.

Configure these settings:
- **Branch to deploy:** `develop`
- **Build command:** `echo 'Edge functions only'`
- **Publish directory:** `dist`
- **Functions directory:** (leave blank, edge functions auto-detected)

Click "Deploy site"

### 4. Get Your Netlify Site URL

After deployment completes:
1. Go to "Site settings" → "General" → "Site details"
2. Find your site name (e.g., `clever-llama-123456`)
3. Your edge function URL will be: `https://clever-llama-123456.netlify.app/api/`

### 5. Update GitHub Pages Deployment

Update the GitHub Actions workflow to use your Netlify proxy:

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions → Variables
3. Edit `NUXT_PUBLIC_API_BASE_URL`
4. Set value to: `https://YOUR-SITE-NAME.netlify.app` (replace with your actual Netlify URL)

**Example:**
```
https://clever-llama-123456.netlify.app
```

### 6. Custom Domain (Optional)

If you have a custom domain:

1. In Netlify: Site settings → Domain management → Add custom domain
2. Follow DNS configuration instructions
3. Update `NUXT_PUBLIC_API_BASE_URL` to your custom domain

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ User Browser                                                    │
│   ↓ visits https://harkairt.github.io/vonno/                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ GitHub Pages (Static Site)                                      │
│   ↓ makes API request to https://YOUR-SITE.netlify.app/api/*   │
│   ↓ connects SignalR to https://YOUR-SITE.netlify.app/chatHub  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Netlify Edge Function (CORS Proxy)                             │
│   ↓ proxies to https://www.innochat.hu/api/* (REST API)        │
│   ↓ proxies to https://www.innochat.hu/chatHub (SignalR)       │
│   ↓ adds CORS headers                                           │
│   ↓ preserves SignalR headers (connectionId, etc.)             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Innochat API (www.innochat.hu)                                  │
│   ↓ processes REST requests                                     │
│   ↓ handles SignalR connections                                 │
│   ↓ returns responses                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Back through the chain
```

### SignalR Support

The edge function **fully supports SignalR**, including:
- ✓ Negotiate endpoint (`/chatHub/negotiate`)
- ✓ Long-polling transport
- ✓ Server-Sent Events (SSE)
- ✓ WebSocket connections (proxied through edge function)
- ✓ SignalR-specific headers preserved
- ✓ Connection credentials maintained

## Testing

After setup, test the proxy:

### Test REST API:
```bash
curl -v https://YOUR-SITE-NAME.netlify.app/api/authentication/login \
  -H "Origin: https://harkairt.github.io" \
  -H "Content-Type: application/json"
```

You should see:
- `Access-Control-Allow-Origin: https://harkairt.github.io` in response headers
- No CORS errors
- Successful proxy to innochat.hu API

### Test SignalR Negotiate:
```bash
curl -v "https://YOUR-SITE-NAME.netlify.app/chatHub/negotiate?negotiateVersion=1" \
  -H "Origin: https://harkairt.github.io" \
  -H "Content-Type: application/json"
```

You should see:
- `Access-Control-Allow-Origin: https://harkairt.github.io` in response headers
- JSON response with `connectionId`, `availableTransports`
- No CORS errors

### Using browser DevTools:
1. Visit https://harkairt.github.io/vonno/
2. Open DevTools → Network tab
3. Try to log in
4. Check requests to Netlify edge function:
   - REST API calls to `/api/*`
   - SignalR negotiate to `/chatHub/negotiate`
   - SignalR connection establishment
5. Verify no CORS errors for any request type

## Troubleshooting

### Edge function not found (404)
- Check `netlify.toml` is in repository root
- Verify `netlify/edge-functions/api-proxy.ts` exists
- Redeploy site: Deploys → Trigger deploy → Deploy site

### CORS error still occurs
- Verify `NUXT_PUBLIC_API_BASE_URL` points to Netlify URL
- Check Netlify function logs: Functions → Edge functions → View logs
- Ensure request goes to Netlify, not directly to innochat.hu

### 502 Bad Gateway
- Check Netlify function logs for errors
- Verify `www.innochat.hu` API is accessible
- Test direct API access: `curl https://www.innochat.hu/api/`

### SignalR connection fails
- Ensure negotiate endpoint works: test `/chatHub/negotiate?negotiateVersion=1`
- Check browser console for SignalR error messages
- Verify `NUXT_PUBLIC_API_BASE_URL` points to Netlify (not innochat.hu)
- Check Netlify function logs for SignalR-specific errors
- Ensure backend SignalR hub allows connections from proxy IP

## Monitoring & Limits

**Free Tier Limits:**
- **Edge Functions:** 125,000 requests/month
- **Bandwidth:** 100GB/month
- **Build minutes:** 300/month (we don't use this)

**Monitor usage:**
- Netlify dashboard → Site → Usage

**What happens if you exceed limits:**
- Edge functions stop serving (gracefully)
- No automatic charges (no credit card on file)
- Upgrade prompt appears

## Local Development

For local development, continue using the Nuxt proxy in `nuxt.config.ts`:

```typescript
// nuxt.config.ts - routeRules already configured
routeRules: {
  '/api/**': {
    proxy: 'https://www.innochat.hu/api/**'
  }
}
```

Local dev bypasses CORS since the proxy runs server-side in Nuxt dev server.

## Maintenance

**When deploying new edge function changes:**
1. Push changes to `develop` branch
2. Netlify automatically redeploys edge functions
3. No need to update GitHub Pages

**When adding new CORS origins:**
Edit `netlify/edge-functions/api-proxy.ts`:
```typescript
'Access-Control-Allow-Origin': 'https://harkairt.github.io', // Add more origins
```

## Cost Estimate

**Expected monthly usage for small-medium app:**
- API requests: ~50k/month
- Bandwidth: ~10GB/month
- **Cost:** $0 (well within free tier)

**Netlify is generous with free tier and will NOT charge without credit card on file.**

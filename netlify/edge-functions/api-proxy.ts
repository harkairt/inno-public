import type { Context } from "@netlify/edge-functions"

export default async (request: Request, context: Context) => {
  const url = new URL(request.url)

  // Determine the target URL based on the path
  let targetUrl: string

  if (url.pathname.startsWith('/chatHub')) {
    // SignalR hub endpoint (includes /negotiate, WebSocket upgrade, etc.)
    const hubPath = url.pathname.replace('/chatHub', '')
    targetUrl = `https://www.innochat.hu/chatHub${hubPath}${url.search}`
  } else if (url.pathname.startsWith('/api/')) {
    // Regular API endpoints
    const apiPath = url.pathname.replace('/api/', '')
    targetUrl = `https://www.innochat.hu/api/${apiPath}${url.search}`
  } else if (url.pathname.startsWith('/assets/')) {
    // Backend static assets (agent avatars, etc.)
    const assetPath = url.pathname.replace('/assets/', '')
    targetUrl = `https://www.innochat.hu/assets/${assetPath}${url.search}`
  } else {
    // Unknown path
    return new Response('Not Found', { status: 404 })
  }

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': 'https://harkairt.github.io',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Request-Id, X-Client-Timestamp, X-Client-User-Agent, X-App-Version, X-Debug-Mode, X-SignalR-User-Agent, Cache-Control, Pragma',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    })
  }

  try {
    // Clone headers but remove host header to avoid conflicts
    const headers = new Headers(request.headers)
    headers.delete('host')

    // For SignalR, preserve specific headers
    if (url.pathname.startsWith('/chatHub')) {
      // SignalR uses these headers for negotiation and transport selection
      // Keep: X-Requested-With, X-SignalR-User-Agent, etc.
    }

    // Forward the request to the actual API
    const apiRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
    })

    // Make the proxied request
    const apiResponse = await fetch(apiRequest)

    // Get response body
    const responseBody = await apiResponse.arrayBuffer()
    const contentType = apiResponse.headers.get('content-type') || 'application/json'

    // Preserve important response headers from the backend
    const responseHeaders = new Headers({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': 'https://harkairt.github.io',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Request-Id, X-Client-Timestamp, X-Client-User-Agent, X-App-Version, X-Debug-Mode, X-SignalR-User-Agent, Cache-Control, Pragma',
      'Access-Control-Allow-Credentials': 'true',
    })

    // For SignalR responses, preserve specific headers
    if (url.pathname.startsWith('/chatHub')) {
      // Copy SignalR-specific headers from backend response
      const signalRHeaders = [
        'x-signalr-connectionid',
        'x-signalr-connectiontoken',
      ]

      signalRHeaders.forEach(header => {
        const value = apiResponse.headers.get(header)
        if (value) {
          responseHeaders.set(header, value)
        }
      })
    }

    // Return response with CORS headers
    return new Response(responseBody, {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Proxy error:', error)

    return new Response(
      JSON.stringify({
        error: 'Proxy request failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://harkairt.github.io',
        },
      }
    )
  }
}

export const config = {
  path: ["/api/*", "/chatHub", "/chatHub/*", "/assets/*"]
}

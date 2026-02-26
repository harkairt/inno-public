# SignalR Real-Time Layer

This module provides a robust SignalR implementation with automatic reconnection, lifecycle management, and Vue 3 integration.

## Overview

The SignalR layer consists of:
- **SignalRService**: Core service class with singleton pattern
- **Vue Composables**: Reactive wrappers for Vue components
- **Type Safety**: Full TypeScript support for all SignalR operations
- **Error Handling**: Comprehensive error handling and recovery
- **Testing**: Mock infrastructure for unit testing

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vue Component │───▶│  useSignalR()    │───▶│ SignalRService  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                         │
                              ▼                         ▼
                       ┌──────────────┐         ┌──────────────┐
                       │   Reactive   │         │   Hub Connection│
                       │    State     │         │    Management   │
                       └──────────────┘         └──────────────┘
```

## Core Features

- ✅ **Singleton Pattern**: Single instance across the application
- ✅ **Automatic Reconnection**: Exponential backoff strategy
- ✅ **Event Persistence**: Handlers survive reconnections
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Error Recovery**: Graceful handling of connection issues
- ✅ **Vue Integration**: Reactive composables for components
- ✅ **Lifecycle Management**: Proper cleanup and resource management

## Quick Start

### Basic Usage

```typescript
import { useSignalR } from '@/composables/useSignalR'

export default defineComponent({
  setup() {
    const signalr = useSignalR()

    // Connect to SignalR hub
    onMounted(async () => {
      try {
        await signalr.connect('your-access-token')
        console.log('Connected to SignalR')
      } catch (error) {
        console.error('Failed to connect:', error)
      }
    })

    // Listen for messages
    const unsubscribe = signalr.onEvent('ReceiveMessage', (message) => {
      console.log('New message:', message)
    })

    // Send message to server
    const sendMessage = async (content: string) => {
      try {
        await signalr.invoke('SendMessage', content)
      } catch (error) {
        console.error('Failed to send message:', error)
      }
    }

    // Cleanup on unmount
    onUnmounted(() => {
      unsubscribe()
      signalr.disconnect()
    })

    return {
      isConnected: signalr.isConnected,
      sendMessage,
    }
  },
})
```

### Connection Monitoring

```typescript
import { useSignalRConnectionMonitor } from '@/composables/useSignalR'

export default defineComponent({
  setup() {
    const monitor = useSignalRConnectionMonitor()

    return {
      statusMessage: monitor.statusMessage,
      statusColor: monitor.statusColor,
      canShowContent: monitor.canShowContent,
    }
  },
})
```

## API Reference

### SignalRService

The core service class that manages the SignalR connection.

#### Constructor (Singleton)

```typescript
const service = SignalRService.getInstance(config)
```

**Config:**
```typescript
interface SignalRConfig {
  hubUrl: string           // WebSocket hub URL
  automaticReconnect: boolean
  reconnectDelays: number[] // Milliseconds between reconnection attempts
}
```

#### Methods

##### `connect(accessToken: string): Promise<void>`
Connect to the SignalR hub with authentication token.

##### `disconnect(): Promise<void>`
Disconnect from the SignalR hub and cleanup resources.

##### `getState(): ConnectionState`
Get current connection state.

**Returns:** `'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'`

##### `on(eventName: string, handler: Function): Function`
Subscribe to SignalR events.

**Returns:** Unsubscribe function

##### `invoke(methodName: string, ...args: any[]): Promise<any>`
Call server method and wait for response.

##### `send(methodName: string, ...args: any[]): void`
Send message to server without waiting for response.

##### `getConnectionInfo(): SignalRConnectionInfo`
Get detailed connection information.

### useSignalR Composable

The main composable for Vue integration.

#### Returns

```typescript
interface UseSignalRReturn {
  // State
  state: Ref<ConnectionState>
  connectionInfo: Ref<SignalRConnectionInfo>
  isConnected: Ref<boolean>
  isConnecting: Ref<boolean>
  isReconnecting: Ref<boolean>
  isDisconnected: Ref<boolean>
  hasError: Ref<boolean>
  reconnectAttempts: Ref<number>
  lastError: Ref<string | null>
  connectionId: Ref<string | undefined>

  // Methods
  connect(accessToken?: string): Promise<void>
  disconnect(): Promise<void>
  forceReconnect(accessToken?: string): Promise<void>
  onEvent<T>(eventName: string, handler: (...args: T[]) => void): () => void
  invoke<T>(methodName: string, ...args: any[]): Promise<T>
  send(methodName: string, ...args: any[]): void
  isReady(): boolean
  getService(): SignalRService
}
```

### useSignalRConnectionMonitor

Specialized composable for connection status monitoring.

#### Returns

```typescript
interface UseSignalRConnectionMonitorReturn extends UseSignalRReturn {
  statusMessage: Ref<string>
  statusColor: Ref<string>
  canShowContent: Ref<boolean>
}
```

## Configuration

### Runtime Configuration

Add to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? ''http://localhost:5000',
    },
  },
})
```

### Environment Variables

```bash
# .env
NUXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

## Connection States

| State | Description | UI Behavior |
|-------|-------------|-------------|
| `disconnected` | Not connected to server | Show connection button |
| `connecting` | Attempting to connect | Show loading indicator |
| `connected` | Successfully connected | Show full interface |
| `reconnecting` | Lost connection, retrying | Show warning + retry count |
| `failed` | Connection failed permanently | Show error message |

## Error Handling

### Connection Errors

```typescript
const signalr = useSignalR()

try {
  await signalr.connect('token')
} catch (error) {
  console.error('Connection failed:', error)
  // Handle connection error
  if (signalr.lastError.value) {
    // Show user-friendly error message
  }
}
```

### Server Method Errors

```typescript
try {
  const result = await signalr.invoke('ServerMethod', arg1, arg2)
} catch (error) {
  console.error('Server method failed:', error)
  // Handle method-specific error
}
```

### Event Handler Errors

Event handlers are wrapped in try-catch to prevent crashes:

```typescript
signalr.onEvent('ReceiveMessage', (message) => {
  try {
    // Process message
  } catch (error) {
    console.error('Error processing message:', error)
    // Handle processing error without crashing
  }
})
```

## Best Practices

### 1. Always Cleanup

```typescript
onUnmounted(() => {
  // Unsubscribe from events
  unsubscribe()

  // Disconnect if this was the last component using the connection
  signalr.disconnect()
})
```

### 2. Check Connection Before Operations

```typescript
if (signalr.isReady()) {
  await signalr.invoke('ServerMethod')
} else {
  console.warn('SignalR not ready')
}
```

### 3. Use Connection Monitor for UI

```typescript
const monitor = useSignalRConnectionMonitor()

// Show appropriate UI based on connection state
<template>
  <div :class="monitor.statusColor">
    {{ monitor.statusMessage }}
  </div>
</template>
```

### 4. Handle Reconnection Scenarios

```typescript
// Subscribe to reconnection events
signalr.onEvent('stateChange', (state) => {
  if (state === 'reconnecting') {
    // Show reconnection UI
  } else if (state === 'connected') {
    // Refresh data, hide reconnection UI
  }
})
```

## Testing

### Mock SignalR for Tests

```typescript
// In your test setup
vi.mock('@microsoft/signalr', () => ({
  HubConnectionState: {
    Disconnected: 0,
    Connecting: 1,
    Connected: 2,
    Reconnecting: 4,
  },
  HubConnectionBuilder: vi.fn(() => ({
    withUrl: vi.fn().mockReturnThis(),
    withAutomaticReconnect: vi.fn().mockReturnThis(),
    configureLogging: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue(mockConnection),
  })),
}))
```

### Test Components

```typescript
import { mount } from '@vue/test-utils'
import MyComponent from '@/components/MyComponent.vue'

test('handles SignalR connection', async () => {
  const wrapper = mount(MyComponent)

  // Mock connection
  await wrapper.vm.signalr.connect()

  expect(wrapper.vm.signalr.isConnected.value).toBe(true)
})
```

## Troubleshooting

### Common Issues

1. **Connection Fails Immediately**
   - Check `hubUrl` configuration
   - Verify server is running and accessible
   - Check CORS settings on server

2. **Authentication Errors**
   - Ensure access token is valid
   - Check token expiration
   - Verify server authentication configuration

3. **Frequent Reconnections**
   - Check network stability
   - Review server timeout settings
   - Monitor server logs for connection drops

4. **Events Not Received**
   - Verify event names match server-side
   - Check event handler registration
   - Ensure connection is established before subscribing

### Debug Mode

Enable SignalR logging for debugging:

```typescript
// In SignalRService constructor
this.connection = new signalR.HubConnectionBuilder()
  .configureLogging(signalR.LogLevel.Debug) // Change from Information to Debug
  .build()
```

## Migration from Old Implementation

If you're migrating from an older SignalR implementation:

1. **Replace Direct HubConnection Usage**
   ```typescript
   // Old
   const connection = new signalR.HubConnectionBuilder().build()

   // New
   const signalr = useSignalR()
   ```

2. **Update Event Subscriptions**
   ```typescript
   // Old
   connection.on('event', handler)

   // New
   const unsubscribe = signalr.onEvent('event', handler)
   ```

3. **Use Reactive State**
   ```typescript
   // Old
   if (connection.state === signalR.HubConnectionState.Connected) {
   // New
   if (signalr.isConnected.value) {
   ```

## Performance Considerations

- **Singleton Pattern**: Ensures only one connection per application
- **Event Handler Cleanup**: Automatically removes handlers on unmount
- **Connection Pooling**: Reuses existing connections
- **Debounced Reconnections**: Prevents excessive reconnection attempts

## Security

- **Token-Based Authentication**: Uses JWT access tokens
- **HTTPS Required**: Always use secure connections in production
- **CORS Configuration**: Configure server to allow your domain
- **Token Refresh**: Handles token expiration gracefully
# SignalR Usage Examples

This document provides practical examples of using the SignalR layer in different scenarios.

## Basic Chat Component

```vue
<template>
  <div class="chat-container">
    <!-- Connection Status -->
    <div :class="['status', monitor.statusColor]">
      {{ monitor.statusMessage }}
    </div>

    <!-- Messages -->
    <div v-if="monitor.canShowContent" class="messages">
      <div
        v-for="message in messages"
        :key="message.id"
        class="message"
      >
        <strong>{{ message.sender }}:</strong> {{ message.content }}
      </div>
    </div>

    <!-- Input Form -->
    <div v-if="monitor.isConnected" class="input-form">
      <input
        v-model="newMessage"
        @keyup.enter="sendMessage"
        placeholder="Type a message..."
        :disabled="sending"
      />
      <button @click="sendMessage" :disabled="sending || !newMessage.trim()">
        Send
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSignalRConnectionMonitor } from '@/composables/useSignalR'

const monitor = useSignalRConnectionMonitor()
const messages = ref<Array<{id: string, sender: string, content: string}>>([])
const newMessage = ref('')
const sending = ref(false)

let unsubscribe: (() => void) | null = null

onMounted(async () => {
  try {
    // Connect to SignalR
    await monitor.connect()

    // Subscribe to new messages
    unsubscribe = monitor.onEvent('ReceiveMessage', (message) => {
      messages.value.push({
        id: message.id,
        sender: message.senderName,
        content: message.content,
      })
    })

    // Subscribe to typing indicators
    monitor.onEvent('UserTyping', (data) => {
      console.log(`${data.user} is typing...`)
    })

  } catch (error) {
    console.error('Failed to connect to chat:', error)
  }
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
  monitor.disconnect()
})

async function sendMessage() {
  if (!newMessage.value.trim() || sending.value) return

  sending.value = true
  try {
    await monitor.invoke('SendMessage', {
      content: newMessage.value,
      chatId: 'room-1',
    })
    newMessage.value = ''
  } catch (error) {
    console.error('Failed to send message:', error)
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.status {
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 14px;
}

.text-green-500 { background-color: #dcfce7; color: #166534; }
.text-yellow-500 { background-color: #fef3c7; color: #92400e; }
.text-red-500 { background-color: #fee2e2; color: #991b1b; }
.text-gray-500 { background-color: #f3f4f6; color: #6b7280; }

.messages {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.message {
  margin-bottom: 8px;
  padding: 8px;
  background-color: #f9fafb;
  border-radius: 4px;
}

.input-form {
  display: flex;
  gap: 8px;
}

.input-form input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.input-form button {
  padding: 8px 16px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.input-form button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}
</style>
```

## Real-time Notifications

```vue
<template>
  <div>
    <!-- Notification Bell -->
    <button @click="toggleNotifications" class="notification-btn">
      <span class="bell-icon">🔔</span>
      <span v-if="unreadCount > 0" class="badge">{{ unreadCount }}</span>
    </button>

    <!-- Notification Panel -->
    <div v-if="showNotifications" class="notification-panel">
      <h3>Notifications</h3>
      <div v-if="notifications.length === 0" class="no-notifications">
        No new notifications
      </div>
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="notification-item"
        :class="{ unread: !notification.read }"
      >
        <div class="notification-header">
          <span class="notification-type">{{ notification.type }}</span>
          <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
        </div>
        <div class="notification-content">{{ notification.message }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useSignalR } from '@/composables/useSignalR'

interface Notification {
  id: string
  type: string
  message: string
  createdAt: Date
  read: boolean
}

const signalr = useSignalR()
const showNotifications = ref(false)
const notifications = ref<Notification[]>([])

const unreadCount = computed(() =>
  notifications.value.filter(n => !n.read).length
)

let unsubscribeNotifications: (() => void) | null = null

onMounted(async () => {
  try {
    await signalr.connect()

    // Subscribe to new notifications
    unsubscribeNotifications = signalr.onEvent('ReceiveNotification', (data) => {
      const notification: Notification = {
        id: data.id,
        type: data.type,
        message: data.message,
        createdAt: new Date(data.createdAt),
        read: false,
      }

      notifications.value.unshift(notification)

      // Show browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.type, {
          body: notification.message,
          icon: '/favicon.ico',
        })
      }
    })

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

  } catch (error) {
    console.error('Failed to connect to notification service:', error)
  }
})

onUnmounted(() => {
  if (unsubscribeNotifications) {
    unsubscribeNotifications()
  }
})

function toggleNotifications() {
  showNotifications.value = !showNotifications.value

  // Mark all as read when opening panel
  if (showNotifications.value) {
    notifications.value.forEach(n => n.read = true)
  }
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return date.toLocaleDateString()
}
</script>

<style scoped>
.notification-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 20px;
}

.bell-icon {
  display: block;
}

.badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: #ef4444;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-panel {
  position: absolute;
  top: 100%;
  right: 0;
  width: 320px;
  max-height: 400px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  z-index: 1000;
}

.notification-panel h3 {
  padding: 16px;
  margin: 0;
  border-bottom: 1px solid #e5e7eb;
  font-size: 16px;
}

.no-notifications {
  padding: 32px;
  text-align: center;
  color: #6b7280;
}

.notification-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.notification-item.unread {
  background-color: #f0f9ff;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.notification-type {
  font-weight: 600;
  font-size: 14px;
}

.notification-time {
  font-size: 12px;
  color: #6b7280;
}

.notification-content {
  font-size: 14px;
  color: #374151;
}
</style>
```

## Live Collaboration Features

```vue
<template>
  <div class="collaboration-container">
    <!-- Active Users -->
    <div class="active-users">
      <h4>Active Users</h4>
      <div class="users-list">
        <div
          v-for="user in activeUsers"
          :key="user.id"
          class="user-item"
        >
          <img :src="user.avatar" :alt="user.name" class="user-avatar" />
          <span class="user-name">{{ user.name }}</span>
          <span class="user-status" :class="user.status"></span>
        </div>
      </div>
    </div>

    <!-- Shared Content -->
    <div class="content-area">
      <div
        ref="contentEditable"
        contenteditable
        @input="handleContentChange"
        @keyup="handleKeyUp"
        class="editable-content"
        placeholder="Start typing..."
      ></div>

      <!-- Cursors for other users -->
      <div
        v-for="cursor in otherCursors"
        :key="cursor.userId"
        class="remote-cursor"
        :style="{
          left: cursor.x + 'px',
          top: cursor.y + 'px',
          backgroundColor: cursor.color
        }"
      >
        <span class="cursor-label">{{ cursor.userName }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSignalR } from '@/composables/useSignalR'

interface User {
  id: string
  name: string
  avatar: string
  status: 'online' | 'away' | 'busy'
}

interface Cursor {
  userId: string
  userName: string
  x: number
  y: number
  color: string
}

const signalr = useSignalR()
const contentEditable = ref<HTMLElement>()
const activeUsers = ref<User[]>([])
const otherCursors = ref<Cursor[]>([])

let typingTimer: NodeJS.Timeout | null = null
let unsubscribeEvents: (() => void)[] = []

onMounted(async () => {
  try {
    await signalr.connect()

    // Subscribe to user presence
    unsubscribeEvents.push(
      signalr.onEvent('UserJoined', (user: User) => {
        const existingIndex = activeUsers.value.findIndex(u => u.id === user.id)
        if (existingIndex === -1) {
          activeUsers.value.push(user)
        }
      })
    )

    unsubscribeEvents.push(
      signalr.onEvent('UserLeft', (userId: string) => {
        activeUsers.value = activeUsers.value.filter(u => u.id !== userId)
        otherCursors.value = otherCursors.value.filter(c => c.userId !== userId)
      })
    )

    unsubscribeEvents.push(
      signalr.onEvent('UserStatusChanged', ({ userId, status }: { userId: string, status: string }) => {
        const user = activeUsers.value.find(u => u.id === userId)
        if (user) {
          user.status = status as any
        }
      })
    )

    // Subscribe to real-time cursors
    unsubscribeEvents.push(
      signalr.onEvent('CursorMoved', (cursor: Cursor) => {
        if (cursor.userId !== getCurrentUserId()) {
          const existingIndex = otherCursors.value.findIndex(c => c.userId === cursor.userId)
          if (existingIndex >= 0) {
            otherCursors.value[existingIndex] = cursor
          } else {
            otherCursors.value.push(cursor)
          }
        }
      })
    )

    // Subscribe to content changes
    unsubscribeEvents.push(
      signalr.onEvent('ContentChanged', ({ userId, content }: { userId: string, content: string }) => {
        if (userId !== getCurrentUserId() && contentEditable.value) {
          // Apply remote content changes
          const selection = saveSelection(contentEditable.value)
          contentEditable.value.innerText = content
          restoreSelection(contentEditable.value, selection)
        }
      })
    )

    // Subscribe to typing indicators
    unsubscribeEvents.push(
      signalr.onEvent('UserTyping', ({ userId, userName }: { userId: string, userName: string }) => {
        if (userId !== getCurrentUserId()) {
          console.log(`${userName} is typing...`)
          // You could show a typing indicator here
        }
      })
    )

    // Join the collaboration session
    await signalr.invoke('JoinSession', {
      sessionId: 'collaboration-room-1',
      userId: getCurrentUserId(),
      userName: getCurrentUserName(),
    })

  } catch (error) {
    console.error('Failed to setup collaboration:', error)
  }
})

onUnmounted(async () => {
  // Cleanup
  unsubscribeEvents.forEach(unsubscribe => unsubscribe())

  try {
    await signalr.invoke('LeaveSession', {
      sessionId: 'collaboration-room-1',
      userId: getCurrentUserId(),
    })
  } catch (error) {
    console.error('Failed to leave session:', error)
  }

  signalr.disconnect()
})

function handleContentChange(event: Event) {
  const target = event.target as HTMLElement
  const content = target.innerText

  // Broadcast content change
  signalr.send('ContentChanged', {
    sessionId: 'collaboration-room-1',
    userId: getCurrentUserId(),
    content,
  })

  // Clear typing timer
  if (typingTimer) {
    clearTimeout(typingTimer)
  }

  // Send typing indicator
  signalr.send('UserTyping', {
    sessionId: 'collaboration-room-1',
    userId: getCurrentUserId(),
    userName: getCurrentUserName(),
  })

  // Stop typing indicator after 1 second
  typingTimer = setTimeout(() => {
    signalr.send('UserStoppedTyping', {
      sessionId: 'collaboration-room-1',
      userId: getCurrentUserId(),
    })
  }, 1000)
}

function handleKeyUp(event: KeyboardEvent) {
  // Handle cursor position changes
  if (contentEditable.value) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      signalr.send('CursorMoved', {
        sessionId: 'collaboration-room-1',
        userId: getCurrentUserId(),
        userName: getCurrentUserName(),
        x: rect.left,
        y: rect.top,
        color: getUserColor(getCurrentUserId()),
      })
    }
  }
}

// Helper functions
function getCurrentUserId(): string {
  return 'user-123' // Get from auth store or context
}

function getCurrentUserName(): string {
  return 'John Doe' // Get from auth store or context
}

function getUserColor(userId: string): string {
  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function saveSelection(element: HTMLElement): any {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(element)
    preCaretRange.setEnd(range.startContainer, range.startOffset)
    return preCaretRange.toString().length
  }
  return 0
}

function restoreSelection(element: HTMLElement, position: number) {
  const selection = window.getSelection()
  if (selection) {
    const range = document.createRange()
    const charCount = position
    let node = element.firstChild
    let charIndex = 0

    while (node && charIndex < charCount) {
      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0
        if (charIndex + textLength >= charCount) {
          range.setStart(node, charCount - charIndex)
          range.setEnd(node, charCount - charIndex)
          break
        }
        charIndex += textLength
      }
      node = node.nextSibling
    }

    selection.removeAllRanges()
    selection.addRange(range)
  }
}
</script>

<style scoped>
.collaboration-container {
  display: flex;
  gap: 20px;
  height: 500px;
}

.active-users {
  width: 200px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.active-users h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.user-name {
  flex: 1;
  font-size: 12px;
}

.user-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.user-status.online { background-color: #10b981; }
.user-status.away { background-color: #f59e0b; }
.user-status.busy { background-color: #ef4444; }

.content-area {
  flex: 1;
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.editable-content {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: none;
  outline: none;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  background-color: white;
}

.editable-content:empty:before {
  content: attr(placeholder);
  color: #9ca3af;
}

.remote-cursor {
  position: absolute;
  width: 2px;
  height: 20px;
  pointer-events: none;
  z-index: 1000;
  transition: all 0.1s ease;
}

.cursor-label {
  position: absolute;
  top: -20px;
  left: 0;
  background-color: inherit;
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 2px;
  white-space: nowrap;
}
</style>
```

## Error Handling with Retry Logic

```typescript
import { ref, onMounted } from 'vue'
import { useSignalR } from '@/composables/useSignalR'

export function useRobustSignalR() {
  const signalr = useSignalR()
  const retryCount = ref(0)
  const maxRetries = 5
  const retryDelay = 2000 // 2 seconds

  const connectWithRetry = async () => {
    try {
      await signalr.connect()
      retryCount.value = 0
      console.log('✅ SignalR connected successfully')
    } catch (error) {
      console.error('❌ SignalR connection failed:', error)

      if (retryCount.value < maxRetries) {
        retryCount.value++
        console.log(`🔄 Retrying connection (${retryCount.value}/${maxRetries})...`)

        setTimeout(() => {
          connectWithRetry()
        }, retryDelay * retryCount.value) // Exponential backoff
      } else {
        console.error('❌ Max retry attempts reached')
        // Show user-friendly error message
        showErrorNotification('Unable to establish connection. Please refresh the page.')
      }
    }
  }

  // Monitor connection and auto-reconnect
  const unsubscribe = signalr.onEvent('stateChange', (state) => {
    if (state === 'failed' && retryCount.value < maxRetries) {
      setTimeout(() => {
        connectWithRetry()
      }, retryDelay)
    }
  })

  onMounted(() => {
    connectWithRetry()
  })

  return {
    signalr,
    retryCount,
    connectWithRetry,
  }
}

// Usage in component
export default defineComponent({
  setup() {
    const { signalr, retryCount, connectWithRetry } = useRobustSignalR()

    return {
      isConnected: signalr.isConnected,
      retryCount,
      manualReconnect: connectWithRetry,
    }
  },
})
```

## Server-Side Integration (C# Example)

```csharp
// Hub configuration in ASP.NET Core
public class ChatHub : Hub
{
    public async Task SendMessage(string content, string chatId)
    {
        var message = new
        {
            Id = Guid.NewGuid().ToString(),
            Content = content,
            SenderName = Context.User.Identity.Name,
            SenderId = Context.UserIdentifier,
            Timestamp = DateTime.UtcNow,
            ChatId = chatId
        };

        await Clients.OthersInGroup(chatId).SendAsync("ReceiveMessage", message);
    }

    public async Task JoinChat(string chatId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, chatId);

        await Clients.OthersInGroup(chatId).SendAsync("UserJoined", new
        {
            UserId = Context.UserIdentifier,
            UserName = Context.User.Identity.Name,
            Timestamp = DateTime.UtcNow
        });
    }

    public override async Task OnDisconnectedAsync(Exception exception)
    {
        // Handle user disconnection
        await base.OnDisconnectedAsync(exception);
    }
}

// Startup configuration
public void ConfigureServices(IServiceCollection services)
{
    services.AddSignalR(options =>
    {
        options.EnableDetailedErrors = true;
        options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    });
}

public void Configure(IApplicationBuilder app, IHostingEnvironment env)
{
    app.UseRouting();

    app.UseEndpoints(endpoints =>
    {
        endpoints.MapHub<ChatHub>("/chatHub");
    });
}
```

These examples demonstrate various real-world scenarios where the SignalR layer can be used effectively in your application.
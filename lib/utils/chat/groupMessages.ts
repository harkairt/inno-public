import type { MessageType, MessageStatus } from '@/lib/types/chat'

// Interface matching API contracts
export interface ChatMessage {
  messageID: string
  sessionID: string
  messageText: string
  messageType: MessageType
  senderUserCode: string
  senderName: string
  sendDate: string
  isRated: boolean
  rating: number | null
  readByUsers: string[]
  status?: MessageStatus // Optional for optimistic updates
}

export interface MessageGroup {
  date: string
  messages: ChatMessage[]
}

/**
 * Groups chat messages by date for better readability
 * @param messages - Array of chat messages to group
 * @returns Array of message groups sorted by date (most recent first)
 */
export function groupMessagesByDate(messages: ChatMessage[]): MessageGroup[] {
  if (!messages || messages.length === 0) {
    return []
  }

  const groups: Map<string, ChatMessage[]> = new Map()

  messages.forEach((message) => {
    const date = formatDate(new Date(message.sendDate))
    if (!groups.has(date)) {
      groups.set(date, [])
    }
    groups.get(date)!.push(message)
  })

  // Convert to array and sort messages within each group by time (oldest first)
  const result: MessageGroup[] = []
  groups.forEach((messages, date) => {
    result.push({
      date,
      messages: messages.sort((a, b) =>
        new Date(a.sendDate).getTime() - new Date(b.sendDate).getTime()
      ),
    })
  })

  // Sort groups by date (most recent first)
  return result.sort((a, b) => {
    const dateA = parseGroupDate(a.date)
    const dateB = parseGroupDate(b.date)
    return dateB.getTime() - dateA.getTime()
  })
}

/**
 * Formats a date into a human-readable group label
 * @param date - Date to format
 * @returns Formatted date string (e.g., "Today", "Yesterday", "Jan 15, 2025")
 */
function formatDate(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDate.getTime() === today.getTime()) {
    return 'Today'
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    })
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }
}

/**
 * Parses a group date string back to a Date object for sorting
 * @param groupDate - The formatted group date string
 * @returns Date object
 */
function parseGroupDate(groupDate: string): Date {
  const now = new Date()

  if (groupDate === 'Today') {
    return now
  } else if (groupDate === 'Yesterday') {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday
  } else {
    // Parse formatted date string
    return new Date(groupDate)
  }
}

/**
 * Formats a time string from ISO date
 * @param dateString - ISO date string
 * @returns Formatted time string (e.g., "14:30")
 */
export function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return ''
    }
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  } catch (error) {
    console.warn('Error formatting time:', dateString, error)
    return ''
  }
}
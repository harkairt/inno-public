/**
 * MessageRating component tests.
 * Uses the REAL useRateMessage mutation + ChatService; the rating POST is
 * observed at the network boundary via an MSW handler spy on the real endpoint
 * (POST /api/AIWebAPI/SetSessionMessageRating).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { server, http } from '@/tests/msw/server'
import { apiOk } from '@/tests/msw/http'
import { useRateMessage } from '~/composables/useChatMutations'
import MessageRating from '~/components/chat/MessageRating.vue'

// useRateMessage is a Nuxt auto-import in the SFC; expose the REAL composable
// as a global so the component uses it (and hits MSW), no mocking.
beforeEach(() => {
  vi.stubGlobal('useRateMessage', useRateMessage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const RATE_URL = '/api/AIWebAPI/SetSessionMessageRating'

const stubs = {
  UIcon: { name: 'UIcon', props: ['name'], template: '<i :data-name="name" />' },
}

function renderRating(props: Record<string, unknown> = {}) {
  return renderWithProviders(MessageRating as Component, {
    props: {
      messageId: 'msg-1',
      sessionId: 'session-1',
      agentId: 7,
      isRated: false,
      rating: null,
      ...props,
    },
    global: { stubs },
  })
}

/** Register a spy handler for the rating endpoint; returns the body-capture spy. */
function spyRateHandler() {
  const spy = vi.fn()
  server.use(
    http.post(RATE_URL, async ({ request }) => {
      spy(await request.json())
      return apiOk(null)
    }),
  )
  return spy
}

describe('MessageRating — rendering', () => {
  it('renders thumbs-up and thumbs-down controls', () => {
    renderRating()
    expect(screen.getByRole('button', { name: 'chat.rating.thumbsUp' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'chat.rating.thumbsDown' })).toBeTruthy()
  })

  it('disables both buttons when already rated', () => {
    renderRating({ isRated: true, rating: 1 })
    expect(screen.getByRole('button', { name: 'chat.rating.thumbsUp' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: 'chat.rating.thumbsDown' })).toHaveProperty(
      'disabled',
      true,
    )
  })
})

describe('MessageRating — posts rating', () => {
  it('posts a positive rating on thumbs-up click', async () => {
    const spy = spyRateHandler()
    renderRating({ messageId: 'msg-1', sessionId: 'session-1', agentId: 7 })

    await fireEvent.click(screen.getByRole('button', { name: 'chat.rating.thumbsUp' }))

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        sessionId: 'session-1',
        messageId: 'msg-1',
        rating: true,
        agentId: 7,
      }),
    )
  })

  it('posts a negative rating on thumbs-down click', async () => {
    const spy = spyRateHandler()
    renderRating({ messageId: 'msg-2', sessionId: 'session-2', agentId: 9 })

    await fireEvent.click(screen.getByRole('button', { name: 'chat.rating.thumbsDown' }))

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        sessionId: 'session-2',
        messageId: 'msg-2',
        rating: false,
        agentId: 9,
      }),
    )
  })

  it('does not post when the message is already rated', async () => {
    const spy = spyRateHandler()
    renderRating({ isRated: true, rating: 1 })

    await fireEvent.click(screen.getByRole('button', { name: 'chat.rating.thumbsUp' }))
    await new Promise((r) => setTimeout(r, 20))

    expect(spy).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/vue'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRenameMutate = vi.fn().mockResolvedValue(true)
const mockDeleteMutate = vi.fn().mockResolvedValue(true)

vi.mock('~/composables/useChatMutations', () => ({
  useUpdateSessionName: () => ({
    mutateAsync: mockRenameMutate,
    isPending: ref(false),
  }),
  useDeleteSession: () => ({
    mutateAsync: mockDeleteMutate,
    isPending: ref(false),
  }),
}))

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

async function renderMenu(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const pinia = createPinia()
  setActivePinia(pinia)

  const { default: SessionItemMenu } = await import('~/components/chat/SessionItemMenu.vue')

  return render(SessionItemMenu, {
    props: {
      sessionId: 'session-1',
      sessionName: 'My Chat',
      agentId: 1,
      ...props,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }], pinia],
      stubs: {
        UButton: {
          name: 'UButton',
          props: ['disabled', 'type', 'loading', 'icon', 'color', 'variant', 'size', 'label'],
          template: '<button :disabled="disabled" :type="type" v-bind="$attrs"><slot>{{ label }}</slot></button>',
        },
        UDropdownMenu: {
          name: 'UDropdownMenu',
          props: ['items'],
          template: '<div data-testid="dropdown"><slot /><button v-for="item in items" :key="item.label" @click="item.onSelect" :data-label="item.label">{{ item.label }}</button></div>',
        },
        UModal: {
          name: 'UModal',
          props: ['open', 'title'],
          emits: ['update:open'],
          template: '<div v-if="open" data-testid="modal" :data-title="title"><slot name="content" /></div>',
        },
        UInput: {
          name: 'UInput',
          props: ['modelValue', 'placeholder', 'disabled'],
          emits: ['update:modelValue'],
          template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" data-testid="session-name-input" />',
        },
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionItemMenu — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dropdown trigger', async () => {
    await renderMenu()

    expect(screen.getByTestId('dropdown')).toBeTruthy()
  })

  it('shows edit name option', async () => {
    await renderMenu()

    expect(screen.getByText('chat.sessionMenu.editName')).toBeTruthy()
  })

  it('shows delete option for non-primary sessions', async () => {
    await renderMenu({ isPrimarySession: false })

    expect(screen.getByText('chat.sessionMenu.delete')).toBeTruthy()
  })

  it('hides delete option for primary sessions', async () => {
    await renderMenu({ isPrimarySession: true })

    expect(screen.queryByText('chat.sessionMenu.delete')).toBeNull()
  })
})

describe('SessionItemMenu — rename', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens edit modal when edit option is clicked', async () => {
    await renderMenu()

    const editButton = screen.getByText('chat.sessionMenu.editName')
    await fireEvent.click(editButton)

    expect(screen.getByTestId('modal')).toBeTruthy()
  })

  it('calls updateSessionName on save with changed name', async () => {
    await renderMenu()

    // Open modal
    await fireEvent.click(screen.getByText('chat.sessionMenu.editName'))

    // Change name
    const input = screen.getByTestId('session-name-input')
    await fireEvent.update(input, 'Renamed Chat')

    // Submit form
    const form = input.closest('form')!
    await fireEvent.submit(form)

    expect(mockRenameMutate).toHaveBeenCalledWith({
      sessionId: 'session-1',
      sessionName: 'Renamed Chat',
      agentId: 1,
    })
  })

  it('does not save when name is unchanged', async () => {
    await renderMenu()

    await fireEvent.click(screen.getByText('chat.sessionMenu.editName'))

    // Submit without changing name
    const input = screen.getByTestId('session-name-input')
    const form = input.closest('form')!
    await fireEvent.submit(form)

    expect(mockRenameMutate).not.toHaveBeenCalled()
  })
})

describe('SessionItemMenu — delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.useRoute).mockReturnValue({
      params: {},
      query: {},
      path: '/',
      fullPath: '/',
    } as any)
  })

  it('opens delete confirmation when delete is clicked', async () => {
    await renderMenu({ isPrimarySession: false })

    await fireEvent.click(screen.getByText('chat.sessionMenu.delete'))

    // Delete modal should appear with confirmation
    const modals = screen.getAllByTestId('modal')
    const deleteModal = modals.find(m => m.getAttribute('data-title') === 'chat.sessionMenu.deleteConfirmTitle')
    expect(deleteModal).toBeTruthy()
  })

  it('navigates to /chats when deleting the active session', async () => {
    vi.mocked(global.useRoute).mockReturnValue({
      params: { sessionId: 'session-1' },
      query: {},
      path: '/chats/session-1',
      fullPath: '/chats/session-1',
    } as any)

    await renderMenu({ isPrimarySession: false })

    await fireEvent.click(screen.getByText('chat.sessionMenu.delete'))
    await fireEvent.click(screen.getAllByText('chat.sessionMenu.delete')[1]!)

    expect(global.navigateTo).toHaveBeenCalledWith('/chats', { replace: true })
  })
})

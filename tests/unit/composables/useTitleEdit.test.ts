import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'

import { useTitleEdit } from '@/app/composables/useTitleEdit'

const mockMutate = vi.fn()
const mockIsPending = ref(false)

vi.mock('@/app/composables/useChatMutations', () => ({
  useUpdateSessionName: vi.fn(() => ({
    mutate: mockMutate,
    isPending: mockIsPending,
  })),
}))

describe('useTitleEdit', () => {
  it('starts with isEditingTitle false', () => {
    const { isEditingTitle } = useTitleEdit('s-1', {
      canEdit: true,
      sessionName: 'Test',
      agentId: 1,
    })
    expect(isEditingTitle.value).toBe(false)
  })

  describe('startEditingTitle', () => {
    it('pre-fills editedTitle with sessionName and sets isEditingTitle', () => {
      const { startEditingTitle, isEditingTitle, editedTitle } = useTitleEdit('s-1', {
        canEdit: true,
        sessionName: 'My Chat',
        agentId: 1,
      })

      startEditingTitle()

      expect(isEditingTitle.value).toBe(true)
      expect(editedTitle.value).toBe('My Chat')
    })

    it('does nothing when canEdit is false', () => {
      const { startEditingTitle, isEditingTitle } = useTitleEdit('s-1', {
        canEdit: false,
        sessionName: 'My Chat',
        agentId: 1,
      })

      startEditingTitle()

      expect(isEditingTitle.value).toBe(false)
    })

    it('focuses input and places cursor at end after nextTick', async () => {
      const { startEditingTitle, titleInputRef } = useTitleEdit('s-1', {
        canEdit: true,
        sessionName: 'Test',
        agentId: 1,
      })

      const mockInput = {
        focus: vi.fn(),
        setSelectionRange: vi.fn(),
        value: 'Test',
      }
      titleInputRef.value = mockInput as unknown as HTMLInputElement

      startEditingTitle()
      await nextTick()

      expect(mockInput.focus).toHaveBeenCalled()
      expect(mockInput.setSelectionRange).toHaveBeenCalledWith(4, 4)
    })
  })

  describe('saveTitle', () => {
    it('calls mutation with trimmed title', () => {
      const { startEditingTitle, editedTitle, saveTitle } = useTitleEdit('s-1', {
        canEdit: true,
        sessionName: 'Old Name',
        agentId: 42,
      })

      startEditingTitle()
      editedTitle.value = '  New Name  '
      saveTitle()

      expect(mockMutate).toHaveBeenCalledWith(
        { sessionId: 's-1', sessionName: 'New Name', agentId: 42 },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      )
    })

    it('skips mutation when title is unchanged', () => {
      mockMutate.mockClear()
      const { startEditingTitle, saveTitle, isEditingTitle } = useTitleEdit('s-1', {
        canEdit: true,
        sessionName: 'Same Name',
        agentId: 1,
      })

      startEditingTitle()
      saveTitle()

      expect(mockMutate).not.toHaveBeenCalled()
      expect(isEditingTitle.value).toBe(false)
    })

    it('cancels when editedTitle is empty/whitespace', () => {
      mockMutate.mockClear()
      const { startEditingTitle, editedTitle, saveTitle, isEditingTitle } = useTitleEdit('s-1', {
        canEdit: true,
        sessionName: 'Test',
        agentId: 1,
      })

      startEditingTitle()
      editedTitle.value = '   '
      saveTitle()

      expect(mockMutate).not.toHaveBeenCalled()
      expect(isEditingTitle.value).toBe(false)
    })

    it('guards against double-fire (no-op if not editing)', () => {
      mockMutate.mockClear()
      const { saveTitle } = useTitleEdit('s-1', {
        canEdit: true,
        sessionName: 'Test',
        agentId: 1,
      })

      saveTitle()
      expect(mockMutate).not.toHaveBeenCalled()
    })

    it('guards against double-fire when mutation is pending', () => {
      mockMutate.mockClear()
      mockIsPending.value = true

      const { startEditingTitle, editedTitle, saveTitle } = useTitleEdit('s-1', {
        canEdit: true,
        sessionName: 'Old',
        agentId: 1,
      })

      startEditingTitle()
      editedTitle.value = 'New'
      saveTitle()

      expect(mockMutate).not.toHaveBeenCalled()
      mockIsPending.value = false
    })
  })

  describe('handleTitleKeydown', () => {
    it('saves on Enter', () => {
      mockMutate.mockClear()
      const { startEditingTitle, editedTitle, handleTitleKeydown } = useTitleEdit('s-1', {
        canEdit: true,
        sessionName: 'Old',
        agentId: 1,
      })

      startEditingTitle()
      editedTitle.value = 'New Title'

      const event = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent
      handleTitleKeydown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockMutate).toHaveBeenCalled()
    })

    it('cancels on Escape', () => {
      const { startEditingTitle, handleTitleKeydown, isEditingTitle } = useTitleEdit('s-1', {
        canEdit: true,
        sessionName: 'Test',
        agentId: 1,
      })

      startEditingTitle()
      expect(isEditingTitle.value).toBe(true)

      const event = { key: 'Escape', preventDefault: vi.fn() } as unknown as KeyboardEvent
      handleTitleKeydown(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(isEditingTitle.value).toBe(false)
    })
  })
})

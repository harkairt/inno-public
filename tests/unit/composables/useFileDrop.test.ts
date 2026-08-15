import { describe, it, expect, vi } from 'vitest'
import { useFileDrop } from '@/app/composables/useFileDrop'

function makeDragEvent(overrides: Partial<DragEvent> = {}): DragEvent {
  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      types: ['Files'],
      files: { length: 0 } as FileList,
      dropEffect: 'none',
    },
    ...overrides,
  } as unknown as DragEvent
}

describe('useFileDrop', () => {
  it('starts with isDraggingOver false', () => {
    const { isDraggingOver } = useFileDrop(vi.fn())
    expect(isDraggingOver.value).toBe(false)
  })

  it('sets isDraggingOver to true on dragEnter with files', () => {
    const { isDraggingOver, onDragEnter } = useFileDrop(vi.fn())
    onDragEnter(makeDragEvent())
    expect(isDraggingOver.value).toBe(true)
  })

  it('does not set isDraggingOver when no Files type in dataTransfer', () => {
    const { isDraggingOver, onDragEnter } = useFileDrop(vi.fn())
    onDragEnter(
      makeDragEvent({
        dataTransfer: { types: ['text/plain'], files: { length: 0 } as FileList } as DataTransfer,
      }),
    )
    expect(isDraggingOver.value).toBe(false)
  })

  it('keeps isDraggingOver true across nested dragenter/dragleave (child element events)', () => {
    const { isDraggingOver, onDragEnter, onDragLeave } = useFileDrop(vi.fn())

    onDragEnter(makeDragEvent())
    onDragEnter(makeDragEvent())
    expect(isDraggingOver.value).toBe(true)

    onDragLeave()
    expect(isDraggingOver.value).toBe(true)

    onDragLeave()
    expect(isDraggingOver.value).toBe(false)
  })

  it('clamps counter at 0 on excess dragleave', () => {
    const { isDraggingOver, onDragLeave, onDragEnter } = useFileDrop(vi.fn())

    onDragLeave()
    onDragLeave()
    expect(isDraggingOver.value).toBe(false)

    onDragEnter(makeDragEvent())
    expect(isDraggingOver.value).toBe(true)
  })

  it('sets dropEffect to copy on dragOver', () => {
    const { onDragOver } = useFileDrop(vi.fn())
    const event = makeDragEvent()
    onDragOver(event)
    expect(event.dataTransfer!.dropEffect).toBe('copy')
  })

  it('forwards files to callback on drop', () => {
    const callback = vi.fn()
    const { onDrop } = useFileDrop(callback)

    const fakeFiles = { length: 2 } as FileList
    onDrop(
      makeDragEvent({
        dataTransfer: { files: fakeFiles } as DataTransfer,
      }),
    )

    expect(callback).toHaveBeenCalledWith(fakeFiles)
  })

  it('does not call callback when no files dropped', () => {
    const callback = vi.fn()
    const { onDrop } = useFileDrop(callback)

    onDrop(
      makeDragEvent({
        dataTransfer: { files: { length: 0 } as FileList } as DataTransfer,
      }),
    )

    expect(callback).not.toHaveBeenCalled()
  })

  it('resets isDraggingOver on drop', () => {
    const { isDraggingOver, onDragEnter, onDrop } = useFileDrop(vi.fn())

    onDragEnter(makeDragEvent())
    expect(isDraggingOver.value).toBe(true)

    onDrop(makeDragEvent())
    expect(isDraggingOver.value).toBe(false)
  })
})

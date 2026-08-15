import { ref } from 'vue'

export function useFileDrop(onFilesDropped: (files: FileList) => void) {
  const isDraggingOver = ref(false)
  let dragEnterCounter = 0

  function onDragEnter(event: DragEvent) {
    event.preventDefault()
    dragEnterCounter++
    if (event.dataTransfer?.types.includes('Files')) {
      isDraggingOver.value = true
    }
  }

  function onDragLeave() {
    dragEnterCounter--
    if (dragEnterCounter <= 0) {
      dragEnterCounter = 0
      isDraggingOver.value = false
    }
  }

  function onDragOver(event: DragEvent) {
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  function onDrop(event: DragEvent) {
    dragEnterCounter = 0
    isDraggingOver.value = false
    const files = event.dataTransfer?.files
    if (files?.length) {
      onFilesDropped(files)
    }
  }

  return {
    isDraggingOver,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
  }
}

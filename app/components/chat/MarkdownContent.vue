<template>
  <!-- eslint-disable vue/no-v-html -- sanitized via DOMPurify in sanitizeHTML() -->
  <div
    v-if="renderedHTML"
    v-viewer.rebuild="hasImages ? {} : false"
    class="markdown-content"
    v-html="renderedHTML"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useMarkdown } from '@/app/composables/useMarkdown'
import { useShiki } from '@/app/composables/useShiki'
import { sanitizeHTML } from '@/app/utils/sanitize'

interface Props {
  content?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  content: null,
})

const { isLoaded: shikiLoaded, loadHighlighter, highlightCode } = useShiki()

// Rendered HTML (reactive to trigger re-render when highlighter loads)
const renderedHTML = ref('')

// Only activate v-viewer when rendered HTML contains images (avoids rebuild overhead during streaming)
const hasImages = computed(() => renderedHTML.value.includes('<img '))

// Check if content contains code blocks (markdown fenced code)
const hasCodeBlocks = (content: string | null | undefined): boolean => {
  return content?.includes('```') ?? false
}

// Max content size for regex processing (100KB) - prevents ReDoS
const MAX_CONTENT_SIZE = 100000

/**
 * Highlight code blocks in HTML string.
 * Uses a safer regex pattern to avoid ReDoS attacks.
 */
const highlightCodeBlocks = (html: string): string => {
  // Skip processing for very large content to prevent ReDoS
  if (html.length > MAX_CONTENT_SIZE) {
    return html
  }

  // Safer regex pattern: match non-greedy with explicit boundaries
  // Uses possessive-like matching by being more specific about content
  const codeBlockRegex = /<pre><code(?:\s+class="language-(\w+)")?>([^]*?)<\/code><\/pre>/g

  return html.replace(codeBlockRegex, (match, lang, code) => {
    try {
      // Decode HTML entities that markdown-it produces
      const decodedCode = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")

      const language = lang ?? 'text'
      const highlighted = highlightCode(decodedCode, language)

      // If highlighting returned the original code, return the match unchanged
      if (highlighted === decodedCode) {
        return match
      }

      return highlighted
    } catch {
      return match
    }
  })
}

/**
 * Render markdown content to sanitized HTML.
 */
const renderContent = () => {
  if (!props.content) {
    renderedHTML.value = ''
    return
  }

  try {
    const { parse } = useMarkdown()
    let html = parse(props.content)

    // Apply syntax highlighting if highlighter is loaded and content has code blocks
    if (shikiLoaded.value && hasCodeBlocks(props.content)) {
      html = highlightCodeBlocks(html)
    }

    // Always sanitize as final step
    renderedHTML.value = sanitizeHTML(html)
  } catch {
    // Fallback to plain text with escaping
    renderedHTML.value = props.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

// Watch for content changes
watch(
  () => props.content,
  () => {
    renderContent()
  },
  { immediate: true }
)

// Re-render when shiki loads (to apply syntax highlighting)
watch(shikiLoaded, (loaded) => {
  if (loaded && hasCodeBlocks(props.content)) {
    renderContent()
  }
})

// Load highlighter on mount if content has code blocks
onMounted(() => {
  if (hasCodeBlocks(props.content)) {
    loadHighlighter()
  }
})
</script>

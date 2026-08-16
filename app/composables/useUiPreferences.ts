import { computed, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'

export type FontFace = 'rubik' | 'nunito' | 'ibm-plex-sans' | 'lexend'
export type FontSize = 'small' | 'medium' | 'large'

const FONT_FACE_KEY_PREFIX = 'innochat_ui_preferred_font_face'
const FONT_SIZE_KEY_PREFIX = 'innochat_ui_preferred_font_size'

export const DEFAULT_FONT_FACE: FontFace = 'nunito'

export const FONT_OPTIONS: { value: FontFace; label: string; family: string }[] = [
  { value: 'nunito', label: 'Nunito', family: "'Nunito', system-ui, sans-serif" },
  { value: 'rubik', label: 'Rubik', family: "'Rubik', system-ui, sans-serif" },
  {
    value: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    family: "'IBM Plex Sans', system-ui, sans-serif",
  },
  { value: 'lexend', label: 'Lexend', family: "'Lexend', system-ui, sans-serif" },
]

export const FONT_SIZE_OPTIONS: { value: FontSize; label: string; rem: number }[] = [
  { value: 'small', label: 'A', rem: 0.8125 },
  { value: 'medium', label: 'A', rem: 0.875 },
  { value: 'large', label: 'A', rem: 1 },
]

const FONT_URLS: Record<FontFace, string> = {
  rubik: 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap',
  nunito: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap',
  'ibm-plex-sans':
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
  lexend: 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap',
}

const loadedFonts = new Set<FontFace>(['nunito'])

function ensureFontLoaded(font: FontFace): void {
  if (loadedFonts.has(font)) return
  const url = FONT_URLS[font]
  if (!url) return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
  loadedFonts.add(font)
}

export function serverConfigFontSizeToPreset(px: number): FontSize {
  if (px <= 13) return 'small'
  if (px >= 16) return 'large'
  return 'medium'
}

export function useUiPreferences() {
  const authStore = useAuthStore()

  const fontFace = ref<FontFace | null>(null)
  const fontSize = ref<FontSize | null>(null)

  const fontFaceKey = computed(() => {
    const id = authStore.user?.id
    return id === undefined ? null : `${FONT_FACE_KEY_PREFIX}_${id}`
  })

  const fontSizeKey = computed(() => {
    const id = authStore.user?.id
    return id === undefined ? null : `${FONT_SIZE_KEY_PREFIX}_${id}`
  })

  function load(): void {
    if (typeof window === 'undefined') {
      fontFace.value = null
      fontSize.value = null
      return
    }

    if (fontFaceKey.value) {
      const stored = localStorage.getItem(fontFaceKey.value)
      fontFace.value = isValidFontFace(stored) ? stored : null
    } else {
      fontFace.value = null
    }

    if (fontSizeKey.value) {
      const stored = localStorage.getItem(fontSizeKey.value)
      fontSize.value = isValidFontSize(stored) ? stored : null
    } else {
      fontSize.value = null
    }

    if (fontFace.value) {
      ensureFontLoaded(fontFace.value)
    }
  }

  function setFontFace(value: FontFace): void {
    ensureFontLoaded(value)
    fontFace.value = value
    if (fontFaceKey.value) {
      try {
        localStorage.setItem(fontFaceKey.value, value)
      } catch {
        // storage blocked or quota-full — preference remains in memory
      }
    }
  }

  function setFontSize(value: FontSize): void {
    fontSize.value = value
    if (fontSizeKey.value) {
      try {
        localStorage.setItem(fontSizeKey.value, value)
      } catch {
        // storage blocked or quota-full — preference remains in memory
      }
    }
  }

  watch(fontFaceKey, load, { immediate: true })
  watch(fontSizeKey, load, { immediate: true })

  return {
    fontFace: computed(() => fontFace.value),
    fontSize: computed(() => fontSize.value),
    setFontFace,
    setFontSize,
  }
}

function isValidFontFace(value: string | null): value is FontFace {
  return value === 'rubik' || value === 'nunito' || value === 'ibm-plex-sans' || value === 'lexend'
}

function isValidFontSize(value: string | null): value is FontSize {
  return value === 'small' || value === 'medium' || value === 'large'
}

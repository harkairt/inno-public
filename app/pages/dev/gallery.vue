<template>
  <div
    class="flex h-dvh flex-col overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
  >
    <header
      class="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur"
    >
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div>
          <div class="font-semibold">{{ gallerySession.sessionName }}</div>
          <div class="text-xs text-[hsl(var(--muted-foreground))]">
            dev only — a synthetic session rendered through the production chat thread
          </div>
        </div>

        <div class="ml-auto flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-1">
            <UButton
              v-for="mode in COLOR_MODES"
              :key="mode"
              size="xs"
              color="neutral"
              :variant="activeMode === mode ? 'solid' : 'outline'"
              @click="setMode(mode)"
            >
              {{ mode }}
            </UButton>
          </div>

          <div class="flex items-center gap-1">
            <UButton
              v-for="preset in WIDTH_PRESETS"
              :key="preset.label"
              size="xs"
              color="neutral"
              :variant="width === preset.px ? 'solid' : 'outline'"
              @click="width = preset.px"
            >
              {{ preset.label }}
            </UButton>
          </div>

          <div class="flex items-center gap-1">
            <UButton
              v-for="code in LOCALES"
              :key="code"
              size="xs"
              color="neutral"
              :variant="activeLocale === code ? 'solid' : 'outline'"
              @click="setLocale(code)"
            >
              {{ code }}
            </UButton>
          </div>
        </div>
      </div>
    </header>

    <main class="min-h-0 flex-1 overflow-y-auto py-4">
      <div
        class="mx-auto flex min-h-full w-full flex-col"
        :style="{ maxWidth: `${width}px` }"
      >
        <div
          class="mx-auto flex min-h-full w-full max-w-(--container-chat) flex-col px-4 md:px-[26px]"
        >
          <div class="flex-1" />
          <ChatMessages
            :messages="gallerySession.messages ?? []"
            :member-count="gallerySession.members.length"
            :active-options-message-id="ACTIVE_OPTIONS_MESSAGE_ID"
            @option-submitted="record"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'
import { ACTIVE_OPTIONS_MESSAGE_ID, gallerySession } from '@/app/dev/fixtures/thread'

definePageMeta({ layout: false })

const COLOR_MODES = ['light', 'dark'] as const
const LOCALES = ['hu', 'en'] as const
const WIDTH_PRESETS = [
  { label: 'mobile', px: 375 },
  { label: 'tablet', px: 768 },
  { label: 'desktop', px: 1280 },
]

const colorMode = useColorMode()
const { locale, setLocale } = useI18n()

const activeMode = computed(() => colorMode.value)
const activeLocale = computed(() => locale.value)
const width = ref(1280)

function setMode(mode: (typeof COLOR_MODES)[number]) {
  colorMode.preference = mode
}

function record(_answer: string) {}
</script>

<template>
  <div class="h-dvh overflow-y-auto bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <header
      class="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur"
    >
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div>
          <div class="font-semibold">Chat component gallery</div>
          <div class="text-xs text-[hsl(var(--muted-foreground))]">
            dev only — fixtures live in <code>app/dev/fixtures/</code>, no backend needed
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

    <main
      class="mx-auto space-y-12 px-4 py-8"
      :style="{ maxWidth: `${width}px` }"
    >
      <section class="space-y-4">
        <h2 class="text-lg font-semibold">OptionsMessage</h2>
        <div
          v-for="scenario in optionsScenarios"
          :key="scenario.id"
          class="rounded-xl border border-[hsl(var(--border))] p-4"
        >
          <div class="mb-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {{ scenario.title }}
          </div>
          <OptionsMessage
            :payload="scenario.props.payload"
            :is-active="scenario.props.isActive"
            :selected-answer="scenario.props.selectedAnswer"
            @submit="(answer) => record(scenario.id, answer)"
          />
          <div
            v-if="emitted[scenario.id] !== undefined"
            class="mt-3 border-t border-dashed border-[hsl(var(--border))] pt-2 text-xs"
          >
            <span class="text-[hsl(var(--muted-foreground))]">emitted submit: </span>
            <code>{{ emitted[scenario.id] }}</code>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold">MarkdownContent</h2>
        <div
          v-for="scenario in markdownScenarios"
          :key="scenario.id"
          class="rounded-xl border border-[hsl(var(--border))] p-4"
        >
          <div class="mb-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {{ scenario.title }}
          </div>
          <MarkdownContent :content="scenario.props.content" />
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold">ChatTable</h2>
        <div
          v-for="scenario in tableScenarios"
          :key="scenario.id"
          class="rounded-xl border border-[hsl(var(--border))] p-4"
        >
          <div class="mb-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {{ scenario.title }}
          </div>
          <ChatTable :table-data="scenario.props.tableData" />
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold">ChatChart</h2>
        <div
          v-for="scenario in chartScenarios"
          :key="scenario.id"
          class="rounded-xl border border-[hsl(var(--border))] p-4"
        >
          <div class="mb-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {{ scenario.title }}
          </div>
          <div class="h-72">
            <ChatChart :config="scenario.props.config" />
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold">ChatEChart</h2>
        <div
          class="sticky top-16 z-10 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 p-3 text-xs backdrop-blur"
        >
          <span class="text-[hsl(var(--muted-foreground))]">chat store composerRequest: </span>
          <code>{{ composerRequest ? composerRequest.text : '—' }}</code>
          <span
            v-if="composerRequest"
            class="text-[hsl(var(--muted-foreground))]"
          >
            (seq {{ composerRequest.seq }})
          </span>
          <UButton
            v-if="composerRequest"
            class="ml-2"
            size="xs"
            color="neutral"
            variant="outline"
            @click="chatStore.clearComposerRequest()"
          >
            clear
          </UButton>
        </div>
        <div
          v-for="scenario in echartsScenarios"
          :key="scenario.id"
          class="rounded-xl border border-[hsl(var(--border))] p-4"
        >
          <div class="mb-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {{ scenario.title }}
          </div>
          <ChatEChart
            :option="scenario.props.option"
            :block-index="scenario.props.blockIndex"
            :source="scenario.props.source"
          />
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold">ChatBarRace</h2>
        <div
          v-for="scenario in barRaceScenarios"
          :key="scenario.id"
          class="rounded-xl border border-[hsl(var(--border))] p-4"
        >
          <div class="mb-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {{ scenario.title }}
          </div>
          <ChatBarRace
            :data="scenario.props.data"
            :block-index="scenario.props.blockIndex"
            :source="scenario.props.source"
          />
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold">ChatMap</h2>
        <div
          v-for="scenario in leafletScenarios"
          :key="scenario.id"
          class="rounded-xl border border-[hsl(var(--border))] p-4"
        >
          <div class="mb-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {{ scenario.title }}
          </div>
          <ChatMap
            :data="scenario.props.data"
            :block-index="scenario.props.blockIndex"
            :source="scenario.props.source"
          />
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold">ChatPivotTable</h2>
        <div
          v-for="scenario in pivotScenarios"
          :key="scenario.id"
          class="rounded-xl border border-[hsl(var(--border))] p-4"
        >
          <div class="mb-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {{ scenario.title }}
          </div>
          <ChatPivotTable :data="scenario.props.data" />
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold">ChatMessages</h2>
        <div class="rounded-xl border border-[hsl(var(--border))] p-4">
          <div class="mb-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Full thread — answered options mid-thread, active options last, sender names on
            (memberCount 3)
          </div>
          <ChatMessages
            :messages="threadMessages"
            :member-count="3"
            :active-options-message-id="ACTIVE_OPTIONS_MESSAGE_ID"
            @option-submitted="(answer) => record('thread', answer)"
          />
          <div
            v-if="emitted.thread !== undefined"
            class="mt-3 border-t border-dashed border-[hsl(var(--border))] pt-2 text-xs"
          >
            <span class="text-[hsl(var(--muted-foreground))]">emitted optionSubmitted: </span>
            <code>{{ emitted.thread }}</code>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import OptionsMessage from '@/app/components/chat/OptionsMessage.vue'
import MarkdownContent from '@/app/components/chat/MarkdownContent.vue'
import ChatTable from '@/app/components/chat/ChatTable.vue'
import ChatChart from '@/app/components/chat/ChatChart.vue'
import ChatEChart from '@/app/components/chat/ChatEChart.vue'
import ChatBarRace from '@/app/components/chat/ChatBarRace.vue'
import ChatMap from '@/app/components/chat/ChatMap.vue'
import ChatPivotTable from '@/app/components/chat/ChatPivotTable.vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'
import { useChatStore } from '~/stores/chat'
import { optionsScenarios } from '@/app/dev/fixtures/options'
import { markdownScenarios } from '@/app/dev/fixtures/markdown'
import { tableScenarios, chartScenarios, pivotScenarios } from '@/app/dev/fixtures/tabular'
import { echartsScenarios } from '@/app/dev/fixtures/echarts'
import { barRaceScenarios } from '@/app/dev/fixtures/barRace'
import { leafletScenarios } from '@/app/dev/fixtures/leaflet'
import { threadMessages, ACTIVE_OPTIONS_MESSAGE_ID } from '@/app/dev/fixtures/thread'

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
const chatStore = useChatStore()
const composerRequest = computed(() => chatStore.composerRequest)

const activeMode = computed(() => colorMode.value)
const activeLocale = computed(() => locale.value)
const width = ref(1280)
const emitted = ref<Record<string, string>>({})

function setMode(mode: (typeof COLOR_MODES)[number]) {
  colorMode.preference = mode
}

function record(id: string, answer: string) {
  emitted.value = { ...emitted.value, [id]: answer }
}
</script>

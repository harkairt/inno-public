<template>
  <!-- eslint-disable vue/no-v-html -- sanitized via DOMPurify in sanitizeHTML() -->
  <div
    v-if="renderedHTML"
    v-viewer.rebuild="hasImages ? {} : false"
    class="markdown-content"
  >
    <div v-html="renderedHTML" />
    <Teleport
      v-for="chart in chartEntries"
      :key="chart.id"
      :to="`[data-chart-id='${chart.id}']`"
      :defer="true"
    >
      <ChatChart :config="chart.config" />
    </Teleport>
    <Teleport
      v-for="table in tableEntries"
      :key="table.id"
      :to="`[data-table-id='${table.id}']`"
      :defer="true"
    >
      <ChatTable :table-data="table.data" />
    </Teleport>
    <Teleport
      v-for="pivot in pivotEntries"
      :key="pivot.id"
      :to="`[data-pivot-id='${pivot.id}']`"
      :defer="true"
    >
      <ChatPivotTable :data="pivot.data" />
    </Teleport>
    <Teleport
      v-for="echart in echartEntries"
      :key="echart.id"
      :to="`[data-echart-id='${echart.id}']`"
      :defer="true"
    >
      <ChatEChart
        :option="echart.option"
        :block-index="echart.blockIndex"
        :source="echart.source"
      />
    </Teleport>
    <Teleport
      v-for="mdTable in mdTableEntries"
      :key="mdTable.id"
      :to="`[data-md-table-id='${mdTable.id}']`"
      :defer="true"
    >
      <MarkdownTableWrapper :table-html="mdTable.html" />
    </Teleport>
  </div>
  <!-- eslint-enable vue/no-v-html -->
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, useId } from 'vue'
import { useMarkdown } from '@/app/composables/useMarkdown'
import { useShiki } from '@/app/composables/useShiki'
import { useChartJs } from '~/composables/useChartJs'
import { useECharts } from '~/composables/useECharts'
import { sanitizeHTML } from '@/app/utils/sanitize'
import { createLogger } from '@/lib/utils/logger'
import { parseChartConfig, type ChartConfig } from '@/lib/validation/chart'
import { parseEChartsOption, type EChartsOption } from '@/lib/validation/echarts'
import {
  parseRowsBlock,
  parseHRowsBlock,
  parsePivotBlock,
  type TableData,
  type PivotData,
} from '@/lib/validation/table'
import ChatChart from '~/components/chat/ChatChart.vue'
import ChatTable from '~/components/chat/ChatTable.vue'
import ChatPivotTable from '~/components/chat/ChatPivotTable.vue'
import ChatEChart from '~/components/chat/ChatEChart.vue'
import MarkdownTableWrapper from '~/components/chat/MarkdownTableWrapper.vue'

interface Props {
  content?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  content: null,
})

const { isLoaded: shikiLoaded, loadHighlighter, highlightCode } = useShiki()
const { isLoaded: chartJsLoaded, loadChartJs } = useChartJs()
const { isLoaded: echartsLoaded, loadECharts } = useECharts()

const logger = createLogger('MarkdownContent')
const reportedRejections = new Set<string>()

const instancePrefix = useId()

interface ChartEntry {
  id: string
  config: ChartConfig
}

interface TableEntry {
  id: string
  data: TableData
}

interface PivotEntry {
  id: string
  data: PivotData
}

interface EChartEntry {
  id: string
  option: EChartsOption
  source: string
  blockIndex: number
}

interface MdTableEntry {
  id: string
  html: string
}

const renderedHTML = ref('')
const chartEntries = ref<ChartEntry[]>([])
const tableEntries = ref<TableEntry[]>([])
const pivotEntries = ref<PivotEntry[]>([])
const echartEntries = ref<EChartEntry[]>([])
const mdTableEntries = ref<MdTableEntry[]>([])

const hasImages = computed(() => renderedHTML.value.includes('<img '))

const hasCodeBlocks = (content: string | null | undefined): boolean => {
  return content?.includes('```') ?? false
}

const hasChartBlocks = (content: string | null | undefined): boolean => {
  if (!content) return false
  const openIdx = content.indexOf('```chart.js')
  if (openIdx === -1) return false
  return content.indexOf('```', openIdx + 11) !== -1
}

const hasEChartsBlocks = (content: string | null | undefined): boolean => {
  if (!content) return false
  const openIdx = content.indexOf('```echarts')
  if (openIdx === -1) return false
  return content.indexOf('```', openIdx + 10) !== -1
}

const hasTableBlocks = (content: string | null | undefined): boolean => {
  if (!content) return false
  return content.includes('```rows') || content.includes('```h-rows')
}

const hasPivotBlocks = (content: string | null | undefined): boolean => {
  if (!content) return false
  return content.includes('```pivot')
}

const MAX_CONTENT_SIZE = 100000

const decodeHtmlEntities = (encoded: string): string =>
  encoded
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

const extractTableBlocks = (html: string): { html: string; entries: TableEntry[] } => {
  const entries: TableEntry[] = []
  let index = 0
  const tableBlockRegex = /<pre><code\s+class="language-(h-rows|rows)">([\s\S]*?)<\/code><\/pre>/g

  const replaced = html.replace(tableBlockRegex, (match, lang: string, encoded: string) => {
    const json = decodeHtmlEntities(encoded)
    const data = lang === 'h-rows' ? parseHRowsBlock(json) : parseRowsBlock(json)
    if (!data) return match

    const id = `${instancePrefix}-table-${index++}`
    entries.push({ id, data })
    return `<div class="table-placeholder" data-table-id="${id}"></div>`
  })

  return { html: replaced, entries }
}

const extractPivotBlocks = (html: string): { html: string; entries: PivotEntry[] } => {
  const entries: PivotEntry[] = []
  let index = 0
  const pivotBlockRegex = /<pre><code\s+class="language-pivot">([\s\S]*?)<\/code><\/pre>/g

  const replaced = html.replace(pivotBlockRegex, (match, encoded: string) => {
    const json = decodeHtmlEntities(encoded)
    const data = parsePivotBlock(json)
    if (!data) return match

    const id = `${instancePrefix}-pivot-${index++}`
    entries.push({ id, data })
    return `<div class="pivot-placeholder" data-pivot-id="${id}"></div>`
  })

  return { html: replaced, entries }
}

const extractChartBlocks = (html: string): { html: string; entries: ChartEntry[] } => {
  const entries: ChartEntry[] = []
  let index = 0
  const chartBlockRegex = /<pre><code\s+class="language-chart\.js">([\s\S]*?)<\/code><\/pre>/g

  const replaced = html.replace(chartBlockRegex, (match, encoded: string) => {
    const config = parseChartConfig(decodeHtmlEntities(encoded))
    if (!config) return match

    const id = `${instancePrefix}-chart-${index++}`
    entries.push({ id, config })
    return `<div class="chart-placeholder" data-chart-id="${id}"></div>`
  })

  return { html: replaced, entries }
}

const extractEChartsBlocks = (html: string): { html: string; entries: EChartEntry[] } => {
  const entries: EChartEntry[] = []
  let index = 0
  const echartsBlockRegex = /<pre><code\s+class="language-echarts">([\s\S]*?)<\/code><\/pre>/g

  const replaced = html.replace(echartsBlockRegex, (match, encoded: string) => {
    const source = decodeHtmlEntities(encoded)
    const parsed = parseEChartsOption(source)
    const blockIndex = index++

    if (parsed.isErr()) {
      const key = `${blockIndex}:${parsed.error.reason}`
      if (!reportedRejections.has(key)) {
        reportedRejections.add(key)
        logger.warn('Rejected ECharts block', { reason: parsed.error.reason, blockIndex })
      }
      return match
    }

    const id = `${instancePrefix}-echart-${blockIndex}`
    entries.push({ id, option: parsed.value, source, blockIndex })
    return `<div class="echart-placeholder" data-echart-id="${id}"></div>`
  })

  return { html: replaced, entries }
}

const extractMarkdownTables = (html: string): { html: string; entries: MdTableEntry[] } => {
  const entries: MdTableEntry[] = []
  let index = 0
  const tableRegex = /<table>[\s\S]*?<\/table>/g

  const replaced = html.replace(tableRegex, (match) => {
    const id = `${instancePrefix}-md-table-${index++}`
    entries.push({ id, html: match })
    return `<div data-md-table-id="${id}"></div>`
  })

  return { html: replaced, entries }
}

const applyEChartsBlocks = (html: string): string => {
  if (!hasEChartsBlocks(props.content)) {
    echartEntries.value = []
    return html
  }

  const result = extractEChartsBlocks(html)
  echartEntries.value = result.entries
  return result.html
}

const highlightCodeBlocks = (html: string): string => {
  if (html.length > MAX_CONTENT_SIZE) return html

  const codeBlockRegex = /<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g

  return html.replace(codeBlockRegex, (match: string, lang: string | undefined, code: string) => {
    try {
      const decodedCode = decodeHtmlEntities(code)
      const language = lang ?? 'text'
      const highlighted = highlightCode(decodedCode, language)

      if (highlighted === decodedCode) return match
      return highlighted
    } catch {
      return match
    }
  })
}

const renderContent = () => {
  if (!props.content) {
    renderedHTML.value = ''
    chartEntries.value = []
    tableEntries.value = []
    pivotEntries.value = []
    echartEntries.value = []
    mdTableEntries.value = []
    return
  }

  try {
    const { parse } = useMarkdown()
    let html = parse(props.content)

    // Extract table blocks BEFORE charts and Shiki
    if (hasTableBlocks(props.content)) {
      try {
        const result = extractTableBlocks(html)
        html = result.html
        tableEntries.value = result.entries
      } catch {
        tableEntries.value = []
      }
    } else {
      tableEntries.value = []
    }

    // Extract pivot blocks BEFORE charts and Shiki
    if (hasPivotBlocks(props.content)) {
      try {
        const result = extractPivotBlocks(html)
        html = result.html
        pivotEntries.value = result.entries
      } catch {
        pivotEntries.value = []
      }
    } else {
      pivotEntries.value = []
    }

    // Extract chart blocks BEFORE Shiki — Shiki's \w+ regex won't match "chart.js"
    if (hasChartBlocks(props.content)) {
      const result = extractChartBlocks(html)
      html = result.html
      chartEntries.value = result.entries
    } else {
      chartEntries.value = []
    }

    html = applyEChartsBlocks(html)

    const mdTableResult = extractMarkdownTables(html)
    html = mdTableResult.html
    mdTableEntries.value = mdTableResult.entries

    if (shikiLoaded.value && hasCodeBlocks(props.content)) {
      html = highlightCodeBlocks(html)
    }

    renderedHTML.value = sanitizeHTML(html)
  } catch {
    renderedHTML.value = props.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    chartEntries.value = []
    tableEntries.value = []
    pivotEntries.value = []
    echartEntries.value = []
    mdTableEntries.value = []
  }
}

watch(
  () => props.content,
  () => {
    renderContent()
  },
  { immediate: true },
)

watch(shikiLoaded, (loaded) => {
  if (loaded && hasCodeBlocks(props.content)) {
    renderContent()
  }
})

watch(chartJsLoaded, (loaded) => {
  if (loaded && chartEntries.value.length > 0) {
    renderContent()
  }
})

watch(echartsLoaded, (loaded) => {
  if (loaded && echartEntries.value.length > 0) {
    renderContent()
  }
})

onMounted(() => {
  if (hasCodeBlocks(props.content)) {
    void loadHighlighter()
  }
  if (hasChartBlocks(props.content)) {
    void loadChartJs()
  }
  if (hasEChartsBlocks(props.content)) {
    void loadECharts()
  }
})
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- pre-sanitized upstream in MarkdownContent -->
  <div class="md-table-wrapper">
    <div v-html="tableHtml" />
    <UTooltip :text="t('chat.table.exportXlsx')">
      <UButton
        icon="i-lucide-download"
        size="xs"
        variant="outline"
        class="md-table-export-btn"
        :loading="isLoading"
        :aria-label="t('chat.table.exportXlsx')"
        @click="handleExport"
      />
    </UTooltip>
  </div>
  <!-- eslint-enable vue/no-v-html -->
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useXlsx } from '~/composables/useXlsx'
import { parseHtmlTable } from '@/app/utils/parseHtmlTable'

interface Props {
  tableHtml: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const { isLoading, exportToXlsx } = useXlsx()
const toast = useToast()

const handleExport = async () => {
  const { headers, rows } = parseHtmlTable(props.tableHtml)
  const success = await exportToXlsx(headers, rows)
  if (!success) {
    toast.add({ title: t('chat.table.exportXlsxFailed'), color: 'error' })
  }
}
</script>

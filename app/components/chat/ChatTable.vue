<template>
  <div
    ref="containerRef"
    class="table-container"
  >
    <div
      v-if="hasFilterable"
      class="table-filter"
    >
      <UInput
        v-model="globalFilter"
        :placeholder="t('chat.table.filter-placeholder')"
        icon="i-lucide-search"
        size="sm"
      />
    </div>

    <UTable
      v-if="paginatedRows.length > 0"
      v-model:sorting="sorting"
      :data="paginatedRows"
      :columns="columns"
      sticky="header"
      :ui="{
        root: 'table-root',
        th: 'text-xs',
        td: 'text-xs !px-4',
      }"
    />

    <div
      v-else
      class="table-empty"
      :style="containerMinWidth ? { minWidth: `${containerMinWidth}px` } : undefined"
    >
      {{ globalFilter ? t('chat.table.no-results') : t('chat.table.no-data') }}
    </div>

    <div
      v-if="totalPages > 1"
      class="table-pagination"
    >
      <UPagination
        v-model:page="currentPage"
        :total="filteredRows.length"
        :items-per-page="PAGE_SIZE"
        :sibling-count="1"
        size="xs"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, h, resolveComponent, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SortingState } from '@tanstack/table-core'
import type { TableData, CellValue } from '@/lib/validation/table'
import { typeRules, type TypeRule } from '@/lib/table-types'

interface Props {
  tableData: TableData
}

const props = defineProps<Props>()

const { t, locale } = useI18n()

const PAGE_SIZE = 20
const currentPage = ref(1)
const globalFilter = ref('')

const sorting = ref<SortingState>([])

const containerRef = useTemplateRef<HTMLDivElement>('containerRef')
const containerMinWidth = ref(0)

const ruleFor = (col: { type: string }): TypeRule =>
  typeRules[col.type as keyof typeof typeRules] ?? typeRules.string

const hasFilterable = computed(() => props.tableData.columns.some((col) => ruleFor(col).filterable))

const sortIcon = (isSorted: false | 'asc' | 'desc') => {
  if (isSorted === 'asc') return 'i-lucide-arrow-up-narrow-wide'
  if (isSorted === 'desc') return 'i-lucide-arrow-down-wide-narrow'
  return 'i-lucide-arrow-up-down'
}

const columns = computed(() =>
  props.tableData.columns.map((col) => {
    const rule = ruleFor(col)
    const headerLabel = col.name

    return {
      accessorKey: col.name,
      header: rule.sortable
        ? ({
            column,
          }: {
            column: {
              getToggleSortingHandler: () => ((e: Event) => void) | undefined
              getIsSorted: () => false | 'asc' | 'desc'
            }
          }) =>
            h(resolveComponent('UButton'), {
              variant: 'ghost',
              label: headerLabel,
              icon: sortIcon(column.getIsSorted()),
              trailing: true,
              class: 'data-[state=open]:bg-(--ui-elevated)',
              size: 'xs',
              onClick: column.getToggleSortingHandler(),
            })
        : headerLabel,
      cell: ({ row }: { row: { original: Record<string, unknown> } }) => {
        const value = row.original[col.name]
        if (col.type === 'boolean') {
          return h(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'center',
                opacity: '0.5',
                pointerEvents: 'none',
              },
            },
            h(resolveComponent('UCheckbox'), { modelValue: Boolean(value) }),
          )
        }
        const formatted = rule.format(value as CellValue, locale.value)
        return h('span', { style: { display: 'block', textAlign: rule.align } }, formatted)
      },
      enableSorting: rule.sortable,
      meta: {
        class: {
          th: `text-${rule.align}`,
          td: `text-${rule.align}`,
        },
      },
    }
  }),
)

const filterableColumns = computed(() =>
  props.tableData.columns.filter((col) => ruleFor(col).filterable),
)

const filteredRows = computed(() => {
  const query = globalFilter.value.toLowerCase().trim()
  if (!query) return props.tableData.rows

  return props.tableData.rows.filter((row) =>
    filterableColumns.value.some((col) => {
      const val = row[col.name]
      if (val == null) return false
      const formatted = ruleFor(col).format(val, locale.value)
      return formatted.toLowerCase().includes(query)
    }),
  )
})

const totalPages = computed(() => Math.ceil(filteredRows.value.length / PAGE_SIZE))

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredRows.value.slice(start, start + PAGE_SIZE)
})

const captureWidth = () => {
  const el = containerRef.value
  if (el && paginatedRows.value.length > 0) {
    containerMinWidth.value = el.scrollWidth
  }
}

watch(globalFilter, () => {
  currentPage.value = 1
})

onMounted(captureWidth)
watch(paginatedRows, (rows) => {
  if (rows.length > 0) {
    requestAnimationFrame(captureWidth)
  }
})
</script>

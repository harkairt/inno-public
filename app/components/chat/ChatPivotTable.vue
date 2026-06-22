<template>
  <UButton
    icon="i-lucide-table-2"
    variant="outline"
    size="sm"
    @click="handleOpen"
  >
    {{ t('chat.pivot.openTable') }}
  </UButton>

  <UModal
    v-model:open="isOpen"
    :fullscreen="isMobile"
    :ui="{
      content: isMobile ? '' : 'sm:max-w-6xl sm:h-[80vh]',
    }"
  >
    <template #content>
      <div class="flex h-full flex-col overflow-hidden">
        <div
          class="relative flex items-center justify-center border-b border-(--ui-border) px-4 py-2"
        >
          <UTabs
            v-model="activeTab"
            :items="tabs"
            :content="false"
            variant="pill"
            size="sm"
          />
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="sm"
            class="absolute right-4"
            @click="isOpen = false"
          />
        </div>

        <div class="flex-1 overflow-auto p-4">
          <ChatTable
            v-show="activeTab === 'table'"
            :table-data="tableData"
          />
          <div
            v-show="activeTab === 'pivot'"
            class="pivot-wrapper"
          >
            <component
              :is="pivotComponent"
              v-if="pivotComponent"
              :data="data"
            />
            <div
              v-else
              class="flex items-center justify-center p-8"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="animate-spin"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Component, type ShallowRef, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PivotData } from '@/lib/validation/table'
import { pivotDataToTableData } from '@/lib/validation/table'
import { usePivotTable } from '~/composables/usePivotTable'
import ChatTable from '~/components/chat/ChatTable.vue'

interface Props {
  data: PivotData
}

const props = defineProps<Props>()

const { t } = useI18n()
const { loadPivotTable, getComponent } = usePivotTable()

const isOpen = ref(false)
const activeTab = ref<string | number>('table')
const pivotComponent: ShallowRef<Component | null> = shallowRef(null)

const isMobile = computed(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false))

const tableData = computed(() => pivotDataToTableData(props.data))

const tabs = computed(() => [
  { label: t('chat.pivot.tabTable'), value: 'table' },
  { label: t('chat.pivot.tabPivot'), value: 'pivot' },
])

const handleOpen = async () => {
  isOpen.value = true
  if (!pivotComponent.value) {
    await loadPivotTable()
    pivotComponent.value = getComponent()
  }
}

watch(activeTab, async (tab) => {
  if (tab === 'pivot' && !pivotComponent.value) {
    await loadPivotTable()
    pivotComponent.value = getComponent()
  }
})
</script>

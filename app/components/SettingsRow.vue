<template>
  <div class="flex items-center justify-between px-4 py-3.5">
    <div class="flex items-center gap-3">
      <UIcon
        :name="icon"
        class="size-5 text-[hsl(var(--muted-foreground))]"
      />
      <span class="text-sm font-medium">{{ label }}</span>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  label: string
}>()
</script>

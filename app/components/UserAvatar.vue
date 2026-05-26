<template>
  <UAvatar
    v-bind="$attrs"
    :src="avatarSrc"
    :alt="alt"
    :size="size"
  >
    <slot />
  </UAvatar>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  image?: string | null
  darkImage?: string | null
  alt?: string
  size?: '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
}>()

const colorMode = useColorMode()

const avatarSrc = computed(() => {
  const isDark = colorMode.value === 'dark'
  if (isDark && props.darkImage) {
    return props.darkImage
  }
  return props.image ?? undefined
})
</script>

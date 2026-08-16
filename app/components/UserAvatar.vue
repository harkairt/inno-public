<template>
  <UAvatar
    v-bind="$attrs"
    :src="avatarSrc"
    :alt="alt"
    :size="size"
    :class="round ? undefined : 'rounded-[15px]!'"
  >
    <slot />
  </UAvatar>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    image?: string | null
    darkImage?: string | null
    alt?: string
    size?: '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
    round?: boolean
  }>(),
  {
    round: true,
  },
)

const colorMode = useColorMode()

const avatarSrc = computed(() => {
  const isDark = colorMode.value === 'dark'
  if (isDark && props.darkImage && !props.darkImage.includes('profilePlaceholder')) {
    return props.darkImage
  }
  if (props.image && !props.image.includes('profilePlaceholder')) {
    return props.image
  }
  return undefined
})
</script>

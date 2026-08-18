<template>
  <UAvatar
    v-bind="$attrs"
    :src="avatarSrc"
    :alt="alt"
    :size="size"
    :class="round ? undefined : borderRadiusClass"
  >
    <slot />
  </UAvatar>
</template>

<script setup lang="ts">
import { sanitizeFileUrl } from '@/app/utils/url'

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
const {
  public: { apiBaseUrl },
} = useRuntimeConfig()

const borderRadiusClass = computed(() => {
  const map: Record<string, string> = {
    '3xs': 'rounded-[4px]!',
    '2xs': 'rounded-[5px]!',
    xs: 'rounded-[6px]!',
    sm: 'rounded-[7px]!',
    md: 'rounded-[8px]!',
    lg: 'rounded-[10px]!',
    xl: 'rounded-[12px]!',
    '2xl': 'rounded-[13px]!',
    '3xl': 'rounded-[15px]!',
  }
  return map[props.size ?? 'md']
})

const avatarSrc = computed(() => {
  const isDark = colorMode.value === 'dark'
  if (isDark && props.darkImage && !props.darkImage.includes('profilePlaceholder')) {
    return sanitizeFileUrl(props.darkImage, apiBaseUrl as string) || undefined
  }
  if (props.image && !props.image.includes('profilePlaceholder')) {
    return sanitizeFileUrl(props.image, apiBaseUrl as string) || undefined
  }
  return undefined
})
</script>

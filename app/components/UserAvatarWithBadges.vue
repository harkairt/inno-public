<template>
  <div class="relative">
    <UserAvatar
      :image="image"
      :dark-image="darkImage"
      :alt="alt"
      :round="isVirtual"
      :size="avatarSize"
      :style="avatarStyle"
      :class="avatarClass"
    >
      <slot />
    </UserAvatar>
    <span
      v-if="isFavorite"
      class="absolute -right-0.5 -top-0.5 grid place-items-center rounded-full border-2 bg-[hsl(var(--amber))]"
      :class="[badgeSizeClass, borderClass]"
      role="img"
      :aria-label="t('users.favorite')"
    >
      <UIcon
        name="i-heroicons-star-solid"
        class="text-white"
        :class="iconSizeClass"
        aria-hidden="true"
      />
    </span>
    <span
      v-if="isVirtual"
      class="absolute -right-0.5 -bottom-0.5 grid place-items-center rounded-full border-2 bg-[hsl(var(--success))]"
      :class="[badgeSizeClass, borderClass]"
      role="img"
      :aria-label="t('users.aiAgent')"
      :data-testid="statusTestId"
    >
      <SparkleIcon
        class="text-white"
        :class="iconSizeClass"
      />
    </span>
    <span
      v-else
      class="absolute -right-0.5 -bottom-0.5 rounded-full border-2"
      :class="[
        badgeSizeClass,
        borderClass,
        isAvailable ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--ink-3))]',
      ]"
      role="img"
      :aria-label="isAvailable ? t('users.available') : t('users.unavailable')"
      :data-testid="statusTestId"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, type StyleValue } from 'vue'
import UserAvatar from '~/components/UserAvatar.vue'
import SparkleIcon from '~/components/icons/SparkleIcon.vue'

type AvatarSize = '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'

const props = withDefaults(
  defineProps<{
    image?: string | null
    darkImage?: string | null
    alt?: string
    isVirtual?: boolean
    avatarSize?: AvatarSize
    avatarStyle?: StyleValue
    avatarClass?: string
    isFavorite?: boolean
    isAvailable?: boolean
    compact?: boolean
    borderToken?: string
    statusTestId?: string
  }>(),
  {
    image: undefined,
    darkImage: undefined,
    alt: undefined,
    avatarSize: 'md',
    avatarStyle: undefined,
    avatarClass: undefined,
    compact: true,
    borderToken: 'background',
    statusTestId: undefined,
  },
)

const { t } = useI18n()

const badgeSizeClass = computed(() => (props.compact ? 'size-3.5' : 'size-4'))
const iconSizeClass = computed(() => (props.compact ? 'size-[7px]' : 'size-2'))
const borderClass = computed(() => `border-[hsl(var(--${props.borderToken}))]`)
</script>

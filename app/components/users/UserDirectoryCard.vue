<template>
  <article
    class="user-directory-card"
    :data-testid="`user-item-${user.id}`"
  >
    <div class="flex min-w-0 items-center gap-3">
      <div class="relative shrink-0">
        <UserAvatar
          :image="user.image"
          :dark-image="user.darkImage"
          :alt="user.name"
          size="xl"
          :round="user.isVirtual"
          :style="!hasAvatar(user.image) ? avatarStyle : undefined"
          class="directory-avatar size-[50px]! transition-transform duration-200"
        >
          {{ initials }}
        </UserAvatar>
        <span
          v-if="favorite"
          class="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full border-2 border-[hsl(var(--card))] bg-[hsl(var(--amber))]"
          role="img"
          :aria-label="t('users.favorite')"
        >
          <UIcon
            name="i-heroicons-star-solid"
            class="size-2 text-white"
            aria-hidden="true"
          />
        </span>
        <span
          v-if="user.isVirtual"
          class="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full border-2 border-[hsl(var(--card))] bg-[hsl(var(--success))]"
          role="img"
          :aria-label="t('users.aiAgent')"
          :data-testid="`user-availability-${user.id}`"
        >
          <SparkleIcon class="size-2 text-white" />
        </span>
        <span
          v-else
          class="absolute -right-0.5 -bottom-0.5 size-4 rounded-full border-2 border-[hsl(var(--card))]"
          :class="user.isAvailable ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--ink-3))]'"
          role="img"
          :aria-label="user.isAvailable ? t('users.available') : t('users.unavailable')"
          :data-testid="`user-availability-${user.id}`"
        />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-1.5">
          <h3 class="truncate font-sans text-[15px] font-bold tracking-normal">
            {{ user.name }}
          </h3>
          <span
            v-if="user.isVirtual"
            class="shrink-0 rounded-md border border-[hsl(var(--primary)/0.12)] bg-[hsl(var(--brand-soft))] px-1.5 py-0.5 text-[9.5px] leading-none font-extrabold tracking-[0.05em] text-[hsl(var(--primary))]"
          >
            AI
          </span>
        </div>
        <p class="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
          {{ user.isVirtual ? t('users.aiAgent') : user.email }}
        </p>
      </div>

      <button
        type="button"
        class="favorite-button"
        :class="favorite ? 'favorite-button-active' : 'favorite-button-inactive'"
        :aria-label="favorite ? t('users.removeFavorite') : t('users.addFavorite')"
        :aria-pressed="favorite"
        :data-testid="`favorite-user-${user.id}`"
        @click="emit('toggleFavorite')"
      >
        <UIcon
          :name="favorite ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
          class="size-[18px]"
          aria-hidden="true"
        />
      </button>
    </div>

    <button
      type="button"
      class="conversation-button"
      :data-testid="`open-conversation-${user.id}`"
      @click="emit('openConversation')"
    >
      <UIcon
        name="i-heroicons-chat-bubble-oval-left"
        class="size-4"
        aria-hidden="true"
      />
      {{ t('users.openConversation') }}
    </button>
  </article>
</template>

<script setup lang="ts">
import UserAvatar from '~/components/UserAvatar.vue'
import SparkleIcon from '~/components/icons/SparkleIcon.vue'
import type { UserDTO } from '@/types/api/schemas'
import { getInitials, getAvatarStyle, hasAvatar } from '@/app/utils/user'

const props = defineProps<{
  user: UserDTO
  favorite: boolean
}>()

const emit = defineEmits<{
  toggleFavorite: []
  openConversation: []
}>()

const { t } = useI18n()

const initials = computed(() => getInitials(props.user.name))
const avatarStyle = computed(() => getAvatarStyle(props.user.email))
</script>

<style scoped>
.user-directory-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 17px;
  border: 1px solid hsl(var(--border));
  border-radius: 18px;
  background: hsl(var(--card));
  box-shadow: 0 1px 2px rgb(20 30 29 / 0.025);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

:deep(.directory-avatar .text-muted) {
  color: hsl(var(--muted-foreground));
}

.user-directory-card:hover,
.user-directory-card:focus-within {
  border-color: hsl(var(--primary) / 0.24);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.favorite-button {
  display: flex;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  cursor: pointer;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}

.favorite-button:hover {
  transform: scale(1.04);
}

.favorite-button-active {
  color: hsl(var(--amber));
  background: hsl(var(--amber-soft));
}

.favorite-button-inactive {
  color: hsl(var(--ink-3));
  background: hsl(var(--surface-2));
}

.conversation-button {
  display: flex;
  width: 100%;
  height: 40px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid hsl(var(--border));
  border-radius: 11px;
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.conversation-button:hover {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary) / 0.32);
  background: hsl(var(--brand-soft) / 0.55);
}

.favorite-button:focus-visible,
.conversation-button:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
</style>

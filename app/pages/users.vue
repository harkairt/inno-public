<template>
  <div
    class="h-full overflow-y-auto bg-[hsl(var(--background))]"
    data-testid="users-page"
  >
    <main
      id="main-content"
      class="mx-auto w-full max-w-[1040px] px-4 pt-6 pb-28 sm:px-6 md:px-9 md:pt-8 md:pb-15"
    >
      <header>
        <h1 class="text-[26px] leading-tight md:text-[28px]">
          {{ t('users.title') }}
        </h1>
        <p
          class="mt-1 max-w-3xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))] md:text-base"
        >
          {{ t('users.subtitle') }}
        </p>

        <SearchInput
          v-model="userSearchQuery"
          :placeholder="t('users.searchPlaceholder')"
          :aria-label="t('users.searchLabel')"
          size="xl"
          class="mt-5 max-w-[480px]"
          data-testid="user-search-input"
        />

        <div
          class="mt-3 flex flex-wrap gap-2"
          role="group"
          :aria-label="t('users.filterLabel')"
        >
          <button
            v-for="filter in filters"
            :key="filter.value"
            type="button"
            class="directory-filter"
            :class="
              activeFilter === filter.value
                ? 'directory-filter-active'
                : 'directory-filter-inactive'
            "
            :aria-pressed="activeFilter === filter.value"
            :data-testid="`user-filter-${filter.value}`"
            @click="activeFilter = filter.value"
          >
            {{ filter.label }}
          </button>
        </div>
      </header>

      <section
        class="mt-6"
        :aria-labelledby="directoryHeadingId"
      >
        <div class="mb-4 flex items-center gap-2.5">
          <h2
            :id="directoryHeadingId"
            class="text-[17px] font-semibold"
          >
            {{ sectionHeading }}
          </h2>
          <span
            class="inline-flex min-w-8 items-center justify-center rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]"
            data-testid="users-result-count"
          >
            {{ visibleUsers.length }}
          </span>
        </div>

        <div
          v-if="isLoadingUsers"
          class="user-directory-grid"
          data-testid="users-loading"
        >
          <USkeleton
            v-for="i in 6"
            :key="i"
            class="h-[142px] rounded-[18px]"
          />
        </div>

        <UAlert
          v-else-if="usersError"
          color="error"
          variant="soft"
        >
          {{ usersError.message }}
        </UAlert>

        <UEmpty
          v-else-if="visibleUsers.length === 0"
          icon="i-heroicons-user-group"
          :description="emptyDescription"
          class="rounded-[18px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/0.55)] py-14"
          data-testid="users-empty"
        />

        <div
          v-else
          class="user-directory-grid"
          data-testid="users-grid"
        >
          <UserDirectoryCard
            v-for="user in visibleUsers"
            :key="user.id"
            :user="user"
            :favorite="isFavorite(user.id)"
            @toggle-favorite="toggleFavorite(user.id)"
            @open-conversation="onUserClick(user.id)"
          />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { UserDTO } from '@/types/api/schemas'
import { useChatListData } from '~/composables/useChatListData'
import { useUserFavorites } from '~/composables/useUserFavorites'
import UserDirectoryCard from '~/components/users/UserDirectoryCard.vue'

type DirectoryFilter = 'all' | 'ai' | 'human' | 'favorites'

const { t } = useI18n()
const router = useRouter()
const directoryHeadingId = 'users-directory-heading'

const activeFilter = ref<DirectoryFilter>('all')

const { filteredUsers, isLoadingUsers, usersError, userSearchQuery, handleUserClick } =
  useChatListData()
const { favoriteIds, isFavorite, toggleFavorite } = useUserFavorites()

const filters = computed<Array<{ value: DirectoryFilter; label: string }>>(() => [
  { value: 'all', label: t('users.filters.all') },
  { value: 'ai', label: t('users.filters.ai') },
  { value: 'human', label: t('users.filters.human') },
  { value: 'favorites', label: t('users.filters.favorites') },
])

const visibleUsers = computed<UserDTO[]>(() => {
  // Reading the list makes this computed update immediately after a favorite toggle.
  void favoriteIds.value

  return filteredUsers.value.filter((user) => {
    if (activeFilter.value === 'ai') return user.isVirtual
    if (activeFilter.value === 'human') return !user.isVirtual
    if (activeFilter.value === 'favorites') return isFavorite(user.id)
    return true
  })
})

const sectionHeading = computed(() => t(`users.headings.${activeFilter.value}`))

const emptyDescription = computed(() => {
  if (userSearchQuery.value.trim()) return t('users.noSearchResults')
  if (activeFilter.value === 'favorites') return t('users.noFavorites')
  return t('users.noUsers')
})

function onUserClick(userId: number) {
  const target = handleUserClick(userId)
  if (target) void router.push(target)
}
</script>

<style scoped>
.user-directory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 304px), 1fr));
  gap: 15px;
}

.directory-filter {
  height: 36px;
  padding: 0 15px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}

.directory-filter:hover {
  transform: translateY(-1px);
}

.directory-filter-active {
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
  background: hsl(var(--primary));
}

.directory-filter-inactive {
  color: hsl(var(--muted-foreground));
  border-color: hsl(var(--border));
  background: hsl(var(--card));
}

.directory-filter-inactive:hover {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary) / 0.35);
}

.directory-filter:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
</style>

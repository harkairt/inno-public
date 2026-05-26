/**
 * Public Mode Composable
 * Provides reactive computed values and helpers for public chat mode
 */

import { computed } from 'vue'
import { useConfigStore } from '@/app/stores/config'

export const usePublicMode = () => {
  const configStore = useConfigStore()

  /**
   * Whether public mode is enabled (publicMode === 1)
   */
  const isPublicMode = computed(() => configStore.config.publicMode === 1)

  /**
   * The agent ID configured for public chat, or null if not set
   */
  const publicAgentId = computed(() => {
    const agentId = configStore.config.publicAgent
    return agentId !== -1 ? agentId : null
  })

  /**
   * Whether there was an authentication error in public mode
   */
  const hasPublicAuthError = computed(() => configStore.publicAuthError)

  /**
   * The public login email from config, or null if not set
   */
  const publicLoginEmail = computed(() => configStore.config.publicLoginEmail)

  /**
   * The public login password from config, or null if not set
   */
  const publicLoginPassword = computed(() => configStore.config.publicLoginPassword)

  /**
   * Whether public mode has valid credentials configured
   */
  const hasPublicCredentials = computed(
    () => !!configStore.config.publicLoginEmail && !!configStore.config.publicLoginPassword,
  )

  /**
   * Check if a given agent ID matches the configured public agent
   */
  const isValidPublicAgent = (agentId: number | string): boolean => {
    const configuredAgent = configStore.config.publicAgent
    if (configuredAgent === -1) return false
    return Number(agentId) === configuredAgent
  }

  /**
   * Get the public chat entry URL for the configured agent
   */
  const getPublicChatUrl = (): string | null => {
    const agentId = publicAgentId.value
    if (agentId === null) return null
    return `/chats/public/new/${agentId}`
  }

  return {
    // Computed
    isPublicMode,
    publicAgentId,
    hasPublicAuthError,
    publicLoginEmail,
    publicLoginPassword,
    hasPublicCredentials,

    // Helper functions
    isValidPublicAgent,
    getPublicChatUrl,
  }
}

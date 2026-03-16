/**
 * Config Store
 * Manages runtime configuration loaded from backend
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { InnoChatConfig } from '@/types/api/schemas'
import { DEFAULT_CONFIG } from '@/lib/config/defaults'
import { configService } from '@/lib/api/services/ConfigService'

export const useConfigStore = defineStore('config', () => {
  // State
  const config = ref<InnoChatConfig>({ ...DEFAULT_CONFIG })
  const isLoaded = ref(false)
  const loadError = ref<Error | null>(null)
  const publicAuthError = ref(false)

  // Computed - typed accessors for common values
  const mainColor = computed(() => config.value.mainColor)
  const backgroundColor = computed(() => config.value.backgroundColor)
  const axiosTimeout = computed(() => config.value.axiosTimeout)
  const watermarkEnabled = computed(() => config.value.watermarkEnabled)

  // Message styling computed
  const ownMessageStyle = computed(() => ({
    backgroundColor: config.value.ownMessageBackgroundColor,
    fontStyle: config.value.messageTextOwnItalic ? 'italic' : 'normal',
    fontWeight: config.value.messageTextOwnBold ? 'bold' : 'normal',
    fontSize: `${config.value.messageTextOwnSize}px`,
    borderWidth: `${config.value.messageBorderThickness}px`,
    borderColor: config.value.messageBorderColor,
    borderStyle: config.value.messageBorderStyle,
    borderRadius: `${config.value.messageBorderRounded}px`,
  }))

  const partnerMessageStyle = computed(() => ({
    backgroundColor: config.value.partnerMessageBackgroundColor,
    fontStyle: config.value.messageTextPartnerItalic ? 'italic' : 'normal',
    fontWeight: config.value.messageTextPartnerBold ? 'bold' : 'normal',
    fontSize: `${config.value.messageTextPartnerSize}px`,
    borderWidth: `${config.value.messageBorderThickness}px`,
    borderColor: config.value.messageBorderColor,
    borderStyle: config.value.messageBorderStyle,
    borderRadius: `${config.value.messageBorderRounded}px`,
  }))

  // Actions
  async function loadConfig(): Promise<void> {
    try {
      const result = await configService.getConfig()

      if (result.isOk()) {
        // Merge with defaults to ensure all fields are present
        config.value = { ...DEFAULT_CONFIG, ...result.value }
        isLoaded.value = true
        loadError.value = null
      } else {
        // Silent failure - use defaults
        loadError.value = result.error
        isLoaded.value = true // Mark as loaded even on failure
      }
    } catch (error) {
      loadError.value = error as Error
      isLoaded.value = true
    }
  }

  function setConfig(newConfig: Partial<InnoChatConfig>): void {
    config.value = { ...config.value, ...newConfig }
  }

  function setPublicAuthError(value: boolean): void {
    publicAuthError.value = value
  }

  return {
    // State
    config,
    isLoaded,
    loadError,
    publicAuthError,

    // Computed
    mainColor,
    backgroundColor,
    axiosTimeout,
    watermarkEnabled,
    ownMessageStyle,
    partnerMessageStyle,

    // Actions
    loadConfig,
    setConfig,
    setPublicAuthError,
  }
})

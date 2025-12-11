/**
 * Config Initialization Plugin
 * Loads runtime configuration from backend and applies values
 * Runs after Pinia is initialized (default order, no enforce)
 */

import { apiClient } from '@/lib/api/client'
import { useConfigStore } from '@/app/stores/config'
import type { InnoChatConfig } from '@/types/api/schemas'

export default defineNuxtPlugin({
  name: 'config-init',
  async setup() {
    console.log('⚙️ Loading application configuration...')

    const configStore = useConfigStore()

    await configStore.loadConfig()

    if (configStore.isLoaded) {
      // Apply axios timeout
      apiClient.defaults.timeout = configStore.axiosTimeout
      console.log(`⏱️ Axios timeout set to ${configStore.axiosTimeout}ms from config`)

      // Apply CSS variables to :root
      if (import.meta.client) {
        applyConfigCssVariables(configStore.config)
        console.log('🎨 CSS variables applied from config')
      }

      console.log('✅ Application configuration loaded successfully')
    } else {
      console.warn('⚠️ Configuration loaded with defaults due to error')
    }

    return {
      provide: {
        configStore,
      },
    }
  },
})

/**
 * Apply configuration values as CSS custom properties to :root
 */
function applyConfigCssVariables(config: InnoChatConfig): void {
  const root = document.documentElement

  // Own message styling
  root.style.setProperty('--config-own-message-bg', config.ownMessageBackgroundColor)
  root.style.setProperty('--config-own-message-font-size', `${config.messageTextOwnSize}px`)
  root.style.setProperty('--config-own-message-font-style', config.messageTextOwnItalic ? 'italic' : 'normal')
  root.style.setProperty('--config-own-message-font-weight', config.messageTextOwnBold ? 'bold' : 'normal')

  // Partner message styling
  root.style.setProperty('--config-partner-message-bg', config.partnerMessageBackgroundColor)
  root.style.setProperty('--config-partner-message-font-size', `${config.messageTextPartnerSize}px`)
  root.style.setProperty('--config-partner-message-font-style', config.messageTextPartnerItalic ? 'italic' : 'normal')
  root.style.setProperty('--config-partner-message-font-weight', config.messageTextPartnerBold ? 'bold' : 'normal')

  // Shared border styling
  root.style.setProperty('--config-message-border-width', `${config.messageBorderThickness}px`)
  root.style.setProperty('--config-message-border-color', config.messageBorderColor)
  root.style.setProperty('--config-message-border-style', config.messageBorderStyle)
  root.style.setProperty('--config-message-border-radius', `${config.messageBorderRounded}px`)

  // App theming (for potential future use)
  root.style.setProperty('--config-main-color', config.mainColor)
  root.style.setProperty('--config-background-color', config.backgroundColor)
}

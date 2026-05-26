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
    const configStore = useConfigStore()

    await configStore.loadConfig()

    if (configStore.isLoaded) {
      // Apply axios timeout
      apiClient.defaults.timeout = configStore.axiosTimeout

      // Apply CSS variables to :root
      if (import.meta.client) {
        applyConfigCssVariables(configStore.config)
      }
    }

    return {
      provide: {
        configStore,
      },
    }
  },
})

function sanitizeCssValue(value: string, type: 'color' | 'style'): string {
  if (type === 'color') {
    const colorPattern =
      /^(?:#[0-9a-fA-F]{3,8}|rgb\(\d+,\s*\d+,\s*\d+\)|rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)|[a-zA-Z]+)$/
    return colorPattern.test(value.trim()) ? value.trim() : ''
  }
  if (type === 'style') {
    const allowed = [
      'none',
      'solid',
      'dashed',
      'dotted',
      'double',
      'groove',
      'ridge',
      'inset',
      'outset',
    ]
    return allowed.includes(value.trim()) ? value.trim() : 'solid'
  }
  return ''
}

/**
 * Apply configuration values as CSS custom properties to :root
 */
function applyConfigCssVariables(config: InnoChatConfig): void {
  const root = document.documentElement

  // Own message styling
  root.style.setProperty(
    '--config-own-message-bg',
    sanitizeCssValue(config.ownMessageBackgroundColor, 'color'),
  )
  root.style.setProperty('--config-own-message-font-size', `${config.messageTextOwnSize}px`)
  root.style.setProperty(
    '--config-own-message-font-style',
    config.messageTextOwnItalic ? 'italic' : 'normal',
  )
  root.style.setProperty(
    '--config-own-message-font-weight',
    config.messageTextOwnBold ? 'bold' : 'normal',
  )

  // Partner message styling
  root.style.setProperty(
    '--config-partner-message-bg',
    sanitizeCssValue(config.partnerMessageBackgroundColor, 'color'),
  )
  root.style.setProperty('--config-partner-message-font-size', `${config.messageTextPartnerSize}px`)
  root.style.setProperty(
    '--config-partner-message-font-style',
    config.messageTextPartnerItalic ? 'italic' : 'normal',
  )
  root.style.setProperty(
    '--config-partner-message-font-weight',
    config.messageTextPartnerBold ? 'bold' : 'normal',
  )

  // Shared border styling
  root.style.setProperty('--config-message-border-width', `${config.messageBorderThickness}px`)
  root.style.setProperty(
    '--config-message-border-color',
    sanitizeCssValue(config.messageBorderColor, 'color'),
  )
  root.style.setProperty(
    '--config-message-border-style',
    sanitizeCssValue(config.messageBorderStyle, 'style'),
  )
  root.style.setProperty('--config-message-border-radius', `${config.messageBorderRounded}px`)

  // App theming (for potential future use)
  root.style.setProperty('--config-main-color', sanitizeCssValue(config.mainColor, 'color'))
  root.style.setProperty(
    '--config-background-color',
    sanitizeCssValue(config.backgroundColor, 'color'),
  )
}

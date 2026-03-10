/**
 * Default configuration values
 * Used as fallback when config.json fails to load
 */

import type { InnoChatConfig } from '@/types/api/schemas'

export const DEFAULT_CONFIG: InnoChatConfig = {
  mainColor: '#027be2',
  backgroundColor: '#ffffff',
  watermarkEnabled: false,
  partnerMessageBackgroundColor: 'rgba(0, 188, 212, 0.302)',
  ownMessageBackgroundColor: 'rgba(189, 189, 189, 0.302)',
  messageBorderThickness: 0,
  messageBorderColor: 'rgba(0, 0, 0, 0)',
  messageBorderStyle: 'solid',
  messageBorderRounded: 2,
  messageTextOwnItalic: false,
  messageTextOwnBold: false,
  messageTextOwnSize: 14,
  messageTextPartnerItalic: false,
  messageTextPartnerBold: false,
  messageTextPartnerSize: 14,
  axiosTimeout: 30000,
  publicMode: 0,
  publicLoginEmail: null,
  publicLoginPassword: null,
  publicAgent: -1,
}

/**
 * Buffer polyfill for browser
 * Required by @gradio/client which uses Node.js Buffer API
 */
import { Buffer } from 'buffer'

export default defineNuxtPlugin(() => {
  if (typeof window !== 'undefined') {
    window.Buffer = Buffer
  }
})

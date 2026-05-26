import VueViewer from 'v-viewer'
import 'viewerjs/dist/viewer.css'

/**
 * Download an image by fetching it as a blob.
 * Falls back to opening in a new tab for cross-origin images that block fetch.
 */
async function downloadImage(src: string) {
  try {
    const response = await fetch(src)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = src.split('/').pop() ?? 'image'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch {
    // Cross-origin fetch blocked — fall back to open in new tab
    window.open(src, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Inject a download button into the viewer toolbar.
 * Called on the `ready` event (viewer fully initialized).
 * Viewerjs appends its overlay to document.body, so we query globally.
 */
function injectDownloadButton() {
  const toolbar = document.querySelector('.viewer-toolbar ul')
  if (!toolbar || toolbar.querySelector('.viewer-download')) return

  const li = document.createElement('li')
  li.setAttribute('role', 'button')
  li.setAttribute('tabindex', '0')
  li.className = 'viewer-download'
  li.setAttribute('aria-label', 'Download image')
  li.style.cssText = 'cursor: pointer;'

  li.addEventListener('click', () => {
    // The currently viewed image is always .viewer-canvas > img
    const img = document.querySelector('.viewer-canvas img') as HTMLImageElement | null
    if (img?.src) void downloadImage(img.src)
  })

  toolbar.appendChild(li)
}

export default defineNuxtPlugin({
  name: 'viewer',
  setup(nuxtApp) {
    nuxtApp.vueApp.use(VueViewer, {
      defaultOptions: {
        // Show image at ~80% of viewport
        initialCoverage: 0.8,

        // Close behaviors: backdrop click + Escape + X button
        backdrop: true,
        button: true,
        keyboard: true,

        // Single-image mode: no navigation or slideshow
        navbar: false,
        loop: false,

        // Zoom controls
        zoomable: true,
        zoomOnTouch: true,
        zoomOnWheel: true,
        zoomRatio: 0.1,

        // Allow moving zoomed image
        movable: true,

        // Disable rotation/flip (unnecessary for chat images)
        rotatable: false,
        scalable: false,

        // Disable built-in transition (it uses transform for zoom-from-thumbnail).
        // Fade effect is handled via CSS on the backdrop/container instead.
        transition: false,
        loading: true,

        // Show image alt text as title
        title: true,

        // Toolbar: zoom controls only (no rotation/flip/nav)
        toolbar: {
          zoomIn: 1,
          zoomOut: 1,
          oneToOne: 1,
          reset: false,
          prev: false,
          play: false,
          next: false,
          rotateLeft: false,
          rotateRight: false,
          flipHorizontal: false,
          flipVertical: false,
        },

        // Inject download button when viewer is ready
        ready: injectDownloadButton,
      },
    })
  },
})

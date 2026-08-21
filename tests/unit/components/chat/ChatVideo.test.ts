import { describe, expect, it } from 'vitest'
import { fireEvent } from '@testing-library/dom'
import ChatVideo from '@/app/components/chat/ChatVideo.vue'
import { renderWithProviders } from '@/tests/utils/render'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const video = {
  src: '/videos/demo.webm',
  title: 'Product tour',
  muted: true,
  preload: 'metadata' as const,
}

describe('ChatVideo', () => {
  it('renders a native HTML5 player with validated data', () => {
    const { getByLabelText, getByText } = renderWithProviders(ChatVideo, {
      props: { data: video, source: JSON.stringify(video), blockIndex: 2 },
    })
    const player = getByLabelText('Product tour') as HTMLVideoElement
    expect(player.controls).toBe(true)
    expect(player.getAttribute('src')).toBe('/videos/demo.webm')
    expect(player.getAttribute('data-block-index')).toBe('2')
    expect(getByText('Product tour')).toBeTruthy()
  })

  it('shows a localized error when the browser cannot load the video', async () => {
    const { getByLabelText, findByText } = renderWithProviders(ChatVideo, {
      props: { data: video, source: JSON.stringify(video), blockIndex: 0 },
    })
    await fireEvent.error(getByLabelText('Product tour'))
    expect(await findByText('chat.video.renderFailed')).toBeTruthy()
  })
})

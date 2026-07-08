/**
 * Component test for SignalRConnectionStatus, driven by the fake SignalR
 * singleton's connection state.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/vue'
import { renderWithProviders } from '@/tests/utils/render'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import SignalRConnectionStatus from '~/components/chat/SignalRConnectionStatus.vue'

// UTooltip / UIcon aren't registered in the test app; stub them so bound attrs
// (aria-label, name, class) fall through to a queryable element.
const stubs = {
  UTooltip: { template: '<div data-testid="tooltip"><slot /></div>' },
  UIcon: { template: '<span data-testid="status-icon"><slot /></span>' },
}

describe('SignalRConnectionStatus', () => {
  it('shows the connected state with the signal icon', () => {
    const fake = installFakeSignalR()
    fake.setState('connected')

    renderWithProviders(SignalRConnectionStatus, { global: { stubs } })

    const icon = screen.getByTestId('status-icon')
    expect(icon.getAttribute('aria-label')).toBe('Connected')
    expect(icon.getAttribute('name')).toBe('i-heroicons-signal')
    expect(icon.className).toContain('text-green-500')
  })

  it('shows a spinning reconnecting indicator with the attempt count', () => {
    const fake = installFakeSignalR()
    fake.setState('reconnecting') // increments reconnectAttempts to 1

    renderWithProviders(SignalRConnectionStatus, { global: { stubs } })

    const icon = screen.getByTestId('status-icon')
    expect(icon.getAttribute('aria-label')).toBe('Reconnecting (1)...')
    expect(icon.getAttribute('name')).toBe('i-heroicons-arrow-path')
    expect(icon.className).toContain('text-yellow-500')
    expect(icon.className).toContain('animate-spin')
  })

  it('shows the disconnected error state with the signal-slash icon', () => {
    const fake = installFakeSignalR()
    fake.setState('disconnected')

    renderWithProviders(SignalRConnectionStatus, { global: { stubs } })

    const icon = screen.getByTestId('status-icon')
    expect(icon.getAttribute('aria-label')).toBe('Disconnected')
    expect(icon.getAttribute('name')).toBe('i-heroicons-signal-slash')
    expect(icon.className).toContain('text-red-500')
  })
})

/**
 * Auth layout: a simple centered container that renders its slot.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/vue'
import { renderWithProviders } from '@/tests/utils/render'
import AuthLayout from '@/app/layouts/auth.vue'

describe('auth layout', () => {
  it('renders the slot content', () => {
    renderWithProviders(AuthLayout, {
      slots: { default: '<form data-testid="login-form" />' },
    })

    expect(screen.getByTestId('login-form')).toBeTruthy()
  })
})

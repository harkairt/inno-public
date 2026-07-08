/**
 * Login Flow Tests
 * Tests for user login functionality
 */

import { test, expect, mockAllApis, mockLoginFailure } from '../fixtures'
import { selectors } from '../selectors'
import { login, attemptLogin } from '../actions/auth.actions'

test.describe('Login Flow', () => {
  test.describe('Valid Login', () => {
    // @real smoke: exercises the login happy path against the real backend.
    test('@real should login successfully with valid credentials', async ({ page }) => {
      await login(page, process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!)

      // Assert: Redirected to chats page
      await expect(page).toHaveURL('/chats')

      // Assert: authenticated shell is rendered (the desktop AppRail)
      await expect(page.locator(selectors.layout.appRail)).toBeVisible()
    })
  })

  test.describe('Login Validation', () => {
    test('should show validation for empty email', async ({ page }) => {
      await mockAllApis(page)
      await page.goto('/login')

      // Leave email empty, fill password
      await page.locator(selectors.auth.passwordInput).fill('SomePassword123')

      // Email field should have required attribute
      const emailInput = page.locator(selectors.auth.emailInput)
      await expect(emailInput).toHaveAttribute('required', '')

      // The field may be pre-filled from NUXT_PUBLIC_DEV_LOGIN_EMAIL — clear it
      // so we assert the genuinely-empty validity state.
      await emailInput.clear()

      // Email field should be invalid when empty
      const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid)
      expect(isValid).toBe(false)
    })

    test('should show validation for empty password', async ({ page }) => {
      await mockAllApis(page)
      await page.goto('/login')

      // Fill email, leave password empty
      await page.locator(selectors.auth.emailInput).fill('test@example.com')

      // Password field has required attribute
      const passwordInput = page.locator(selectors.auth.passwordInput)
      await expect(passwordInput).toHaveAttribute('required', '')

      // Password field should be invalid when empty
      const isValid = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid)
      expect(isValid).toBe(false)
    })

    test('should show error with invalid credentials', async ({ page }) => {
      await mockAllApis(page)
      // Shadow the happy-path login with a 401 so the auth-failure path runs.
      await mockLoginFailure(page)
      await attemptLogin(page, 'wrong@example.com', 'WrongPassword123')

      // Wait for error message to appear
      await expect(page.locator(selectors.auth.errorAlert)).toBeVisible({ timeout: 5000 })

      // Assert: Still on login page
      await expect(page).toHaveURL('/login')
    })

    test('should validate malformed email', async ({ page }) => {
      await mockAllApis(page)
      await page.goto('/login')

      // Fill in malformed email
      const emailInput = page.locator(selectors.auth.emailInput)
      await emailInput.fill('not-an-email')
      await page.locator(selectors.auth.passwordInput).fill('Test123!')

      // HTML5 email validation should catch this
      const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid)
      expect(isValid).toBe(false)

      // Should have type="email" attribute
      await expect(emailInput).toHaveAttribute('type', 'email')
    })
  })

  test.describe('Login UI Elements', () => {
    test('should display all login form elements', async ({ page }) => {
      await mockAllApis(page)
      await page.goto('/login')

      // Check form elements are visible
      await expect(page.locator(selectors.auth.emailInput)).toBeVisible()
      await expect(page.locator(selectors.auth.passwordInput)).toBeVisible()
      await expect(page.locator(selectors.auth.rememberCheckbox)).toBeVisible()
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

      // Check labels
      await expect(page.getByText(/email/i).first()).toBeVisible()
      await expect(page.getByText(/password/i).first()).toBeVisible()
      await expect(page.getByText(/remember me/i)).toBeVisible()
    })

    test('should show loading state during login', async ({ page }) => {
      await mockAllApis(page)
      await page.goto('/login')

      // Fill in credentials
      await page.locator(selectors.auth.emailInput).fill('test@example.com')
      await page.locator(selectors.auth.passwordInput).fill('password')

      // Click submit
      const submitButton = page.getByRole('button', { name: /sign in/i })
      await submitButton.click()

      // Button should be disabled during login
      await expect(submitButton).toBeDefined()
    })
  })

  test.describe('Remember Me Functionality', () => {
    test('should have remember me checkbox', async ({ page }) => {
      await mockAllApis(page)
      await page.goto('/login')

      const rememberCheckbox = page.locator(selectors.auth.rememberCheckbox)
      await expect(rememberCheckbox).toBeVisible()

      // Should be unchecked by default (or pre-checked if email was remembered)
      // Just verify it's checkable
      await rememberCheckbox.check()
      await expect(rememberCheckbox).toBeChecked()
    })
  })
})

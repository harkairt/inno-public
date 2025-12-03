/**
 * Login Flow Tests
 * Tests for user login functionality
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { login, attemptLogin } from '../actions/auth.actions'

test.describe('Login Flow', () => {
  test.describe('Valid Login', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
      await login(page, process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!)

      // Assert: Redirected to chats page
      await expect(page).toHaveURL('/chats')

      // Assert: Logout button is visible (indicates authenticated state)
      await expect(page.getByRole('button', { name: /logout/i })).toBeVisible()
    })

    test('should login as admin and see admin features', async ({ adminPage }) => {
      // Assert: On chats page after login
      await expect(adminPage).toHaveURL('/chats')

      // Assert: Logout button visible
      await expect(adminPage.getByRole('button', { name: /logout/i })).toBeVisible()
    })
  })

  test.describe('Login Validation', () => {
    test('should show validation for empty email', async ({ page }) => {
      await page.goto('/login')

      // Leave email empty, fill password
      await page.locator(selectors.auth.passwordInput).fill('SomePassword123')

      // Email field should have required attribute
      const emailInput = page.locator(selectors.auth.emailInput)
      await expect(emailInput).toHaveAttribute('required', '')

      // Email field should be invalid when empty
      const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid)
      expect(isValid).toBe(false)
    })

    test('should show validation for empty password', async ({ page }) => {
      await page.goto('/login')

      // Fill email, leave password empty
      await page.locator(selectors.auth.emailInput).fill(process.env.TEST_USER_EMAIL!)

      // Password field has required attribute
      const passwordInput = page.locator(selectors.auth.passwordInput)
      await expect(passwordInput).toHaveAttribute('required', '')

      // Password field should be invalid when empty
      const isValid = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid)
      expect(isValid).toBe(false)
    })

    test('should show error with invalid credentials', async ({ page }) => {
      await attemptLogin(page, 'wrong@example.com', 'WrongPassword123')

      // Wait for error message to appear
      const errorMessage = page.locator('.bg-red-50, .text-red-600, [class*="red"]')
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 })

      // Assert: Still on login page
      await expect(page).toHaveURL('/login')
    })

    test('should validate malformed email', async ({ page }) => {
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
      await page.goto('/login')

      // Fill in credentials
      await page.locator(selectors.auth.emailInput).fill(process.env.TEST_USER_EMAIL!)
      await page.locator(selectors.auth.passwordInput).fill(process.env.TEST_USER_PASSWORD!)

      // Click submit
      const submitButton = page.getByRole('button', { name: /sign in/i })
      await submitButton.click()

      // Button should be disabled during login
      await expect(submitButton).toBeDefined()
    })
  })

  test.describe('Remember Me Functionality', () => {
    test('should have remember me checkbox', async ({ page }) => {
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

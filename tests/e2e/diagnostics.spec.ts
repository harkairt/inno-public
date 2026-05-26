/* eslint-disable no-console -- Diagnostics test purposefully logs to console to capture browser state for debugging */
import { test } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Diagnostic test to investigate white screen issue in Playwright
 * This test captures comprehensive state information to identify the root cause
 */
test.describe('Playwright White Screen Diagnostics', () => {
  test('capture diagnostic information', async ({ page }, testInfo) => {
    const diagnosticsDir = path.join(testInfo.outputDir, 'diagnostics')

    // Ensure diagnostics directory exists
    if (!fs.existsSync(diagnosticsDir)) {
      fs.mkdirSync(diagnosticsDir, { recursive: true })
    }

    // Capture console messages
    const consoleMessages: string[] = []
    page.on('console', (msg) => {
      const message = `[${msg.type()}] ${msg.text()}`
      consoleMessages.push(message)
      console.log('Browser console:', message)
    })

    // Capture network requests
    const networkRequests: Array<{ url: string; method: string; resourceType: string }> = []
    page.on('request', (request) => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      })
    })

    // Capture failed requests
    const failedRequests: Array<{ url: string; failure: string | undefined }> = []
    page.on('requestfailed', (request) => {
      const failure = {
        url: request.url(),
        failure: request.failure()?.errorText,
      }
      failedRequests.push(failure)
      console.error('Failed request:', failure)
    })

    // Capture page errors
    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
      console.error('Page error:', error.message)
    })

    console.log('\n=== Starting diagnostic navigation to /login ===\n')

    // Navigate to login page
    const response = await page.goto('http://localhost:3000/login')

    // Log response status
    console.log('Response status:', response?.status())
    console.log('Response URL:', response?.url())

    // Wait for different load states and log timing
    console.log('\n=== Waiting for load states ===')

    await page.waitForLoadState('domcontentloaded')
    console.log('✓ DOM content loaded')

    await page.waitForLoadState('load')
    console.log('✓ Load event fired')

    await page.waitForLoadState('networkidle')
    console.log('✓ Network idle')

    // Capture viewport information
    const viewport = page.viewportSize()
    console.log('\n=== Viewport ===')
    console.log('Viewport size:', viewport)

    // Capture page content
    const htmlContent = await page.content()
    fs.writeFileSync(path.join(diagnosticsDir, 'page-content.html'), htmlContent)
    console.log('\n✓ HTML content saved to page-content.html')
    console.log('HTML length:', htmlContent.length, 'characters')

    // Check if Nuxt app div exists
    const nuxtApp = await page.locator('#__nuxt').count()
    console.log('\n=== Nuxt App Mount Point ===')
    console.log('#__nuxt elements found:', nuxtApp)

    if (nuxtApp > 0) {
      const nuxtAppHTML = await page.locator('#__nuxt').innerHTML()
      console.log('#__nuxt innerHTML length:', nuxtAppHTML.length, 'characters')

      if (nuxtAppHTML.length === 0) {
        console.warn('⚠️  WARNING: #__nuxt exists but is EMPTY - app not mounting!')
      }
    } else {
      console.error('❌ ERROR: #__nuxt not found - Nuxt not initializing!')
    }

    // Check for login form elements
    console.log('\n=== Login Form Elements ===')
    const emailInput = await page.locator('#email').count()
    const passwordInput = await page.locator('#password').count()
    const loginForm = await page.locator('form').count()

    console.log('#email inputs found:', emailInput)
    console.log('#password inputs found:', passwordInput)
    console.log('forms found:', loginForm)

    // Take screenshots at different states
    await page.screenshot({
      path: path.join(diagnosticsDir, 'full-page.png'),
      fullPage: true,
    })
    console.log('\n✓ Full page screenshot saved')

    await page.screenshot({
      path: path.join(diagnosticsDir, 'viewport.png'),
    })
    console.log('✓ Viewport screenshot saved')

    // Save console messages
    fs.writeFileSync(path.join(diagnosticsDir, 'console.log'), consoleMessages.join('\n'))
    console.log('\n✓ Console messages saved')
    console.log('Total console messages:', consoleMessages.length)

    // Save network requests
    fs.writeFileSync(
      path.join(diagnosticsDir, 'network.json'),
      JSON.stringify(networkRequests, null, 2),
    )
    console.log('\n✓ Network requests saved')
    console.log('Total requests:', networkRequests.length)

    // Save failed requests
    if (failedRequests.length > 0) {
      fs.writeFileSync(
        path.join(diagnosticsDir, 'failed-requests.json'),
        JSON.stringify(failedRequests, null, 2),
      )
      console.error('\n❌ Failed requests saved:', failedRequests.length)
    }

    // Save page errors
    if (pageErrors.length > 0) {
      fs.writeFileSync(path.join(diagnosticsDir, 'page-errors.log'), pageErrors.join('\n'))
      console.error('\n❌ Page errors saved:', pageErrors.length)
    }

    // Print summary
    console.log('\n=== DIAGNOSTIC SUMMARY ===')
    console.log('Viewport:', viewport?.width, 'x', viewport?.height)
    console.log('HTML length:', htmlContent.length)
    console.log('#__nuxt found:', nuxtApp > 0 ? 'YES' : 'NO')
    console.log('#email found:', emailInput > 0 ? 'YES' : 'NO')
    console.log('Console messages:', consoleMessages.length)
    console.log('Network requests:', networkRequests.length)
    console.log('Failed requests:', failedRequests.length)
    console.log('Page errors:', pageErrors.length)
    console.log('\nDiagnostic files saved to:', diagnosticsDir)
    console.log('\n=================================\n')

    // This test is purely diagnostic - we don't fail it based on missing elements
    // The output will tell us what's wrong
  })
})

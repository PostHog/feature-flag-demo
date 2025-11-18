/**
 * Integration tests for flag evaluation data flow from Flag Evaluation Settings to iframe
 *
 * Tests the complete flow:
 * 1. Flag Evaluation Form collects settings
 * 2. In server mode: calls /api/evaluate-flags to get bootstrapped data
 * 3. Passes config to main page's handleAppRestart
 * 4. Main page restarts iframe with config URL param
 * 5. Browser-demo page receives config and initializes PostHog
 * 6. User Identity component displays the PostHog state
 */

import { test, expect } from '@playwright/test';

test.describe('Flag Evaluation Data Flow', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Wait for the main restart button to be ready instead of networkidle
    await page.getByRole('button', { name: /Restart App/ }).waitFor({ timeout: 10000 });
  });

  test('Client mode: no server data should be passed', async ({ page }) => {
    // Ensure we're in client mode
    await page.getByRole('combobox', { name: 'Flag evaluation method:' }).click();
    await page.getByRole('option', { name: 'Client side' }).click();

    // Restart the app
    await page.getByRole('button', { name: 'Restart App in client-side mode' }).click();

    // Wait for iframe to load
    const iframe = page.frameLocator('iframe[title="Browser Simulation"]');
    await iframe.getByText('PostHog ready for interactions').waitFor({ timeout: 10000 });

    // Check that no server data was passed
    const logs = await iframe.locator('[data-testid="console-logs"] .log-entry').allTextContents();

    // Should see no bootstrap flags in the logs
    const bootstrapLogs = logs.filter(log => log.includes('Bootstrap flags provided'));
    expect(bootstrapLogs).toHaveLength(0);

    // Should initialize with basic config only
    const initLogs = logs.filter(log => log.includes('Initializing PostHog'));
    expect(initLogs.length).toBeGreaterThan(0);

    const initConfig = initLogs[0];
    expect(initConfig).toContain('api_host');
    expect(initConfig).not.toContain('bootstrap');
  });

  test('Server mode: distinct_id and flags should be bootstrapped when provided', async ({ page }) => {
    // Switch to server mode
    await page.getByRole('combobox', { name: 'Flag evaluation method:' }).click();
    await page.getByRole('option', { name: 'Server side', exact: true }).click();

    // Add a distinct ID
    await page.getByPlaceholder('Enter distinct ID to pass from server (or leave empty for anonymous)').fill('test-user-123');

    // Add person properties
    await page.getByPlaceholder('Property key').fill('email');
    await page.getByPlaceholder('Property value').fill('test@example.com');
    await page.getByRole('button').filter({ hasText: '+' }).click();

    await page.getByPlaceholder('Property key').fill('plan');
    await page.getByPlaceholder('Property value').fill('premium');
    await page.getByRole('button').filter({ hasText: '+' }).click();

    // Monitor network requests to /api/evaluate-flags
    const evaluateRequest = page.waitForRequest('**/api/evaluate-flags');

    // Restart the app
    await page.getByRole('button', { name: /Restart App in server/ }).click();

    // Verify the server request was made with correct data
    const request = await evaluateRequest;
    const requestBody = await request.postDataJSON();

    expect(requestBody).toEqual(
      expect.objectContaining({
        distinctId: 'test-user-123',
        personProperties: {
          email: 'test@example.com',
          plan: 'premium'
        },
        evaluationMethod: 'server-side'
      })
    );

    // Wait for iframe to load
    const iframe = page.frameLocator('iframe[title="Browser Simulation"]');
    await iframe.getByText('PostHog ready for interactions').waitFor({ timeout: 10000 });

    // Check that server data was properly bootstrapped
    const logs = await iframe.locator('[data-testid="console-logs"] .log-entry').allTextContents();

    // Should see bootstrap flags in the logs
    const bootstrapLogs = logs.filter(log => log.includes('Bootstrap flags provided'));
    expect(bootstrapLogs.length).toBeGreaterThan(0);

    // Check PostHog initialization includes bootstrap data
    const initLogs = logs.filter(log => log.includes('Initializing PostHog'));
    expect(initLogs.length).toBeGreaterThan(0);

    const initConfig = initLogs[0];
    expect(initConfig).toContain('bootstrap');
    expect(initConfig).toContain('featureFlags');

    // Verify the User Identity component shows the correct distinct_id
    const postHogStatus = iframe.locator('[data-testid="posthog-status"]');
    await expect(postHogStatus.getByText('test-user-123')).toBeVisible();
    await expect(postHogStatus.getByText('Yes')).toBeVisible(); // Should be identified
  });

  test('Server mode: empty distinct_id should default to "anonymous"', async ({ page }) => {
    // Switch to server mode
    await page.getByRole('combobox', { name: 'Flag evaluation method:' }).click();
    await page.getByRole('option', { name: 'Server side', exact: true }).click();

    // Don't provide a distinct_id (leave empty)

    // Monitor network requests
    const evaluateRequest = page.waitForRequest('**/api/evaluate-flags');

    // Restart the app
    await page.getByRole('button', { name: /Restart App in server/ }).click();

    // Verify the server request defaults distinct_id to "anonymous"
    const request = await evaluateRequest;
    const requestBody = await request.postDataJSON();

    expect(requestBody.distinctId).toBe('anonymous');
  });

  test('Advanced config settings should propagate correctly', async ({ page }) => {
    // Test advanced_disable_flags setting
    await page.getByRole('combobox', { name: 'Web SDK Advanced Flag Config:' }).click();
    await page.getByRole('option', { name: 'advanced_disable_flags: true (no flag calls)' }).click();

    // Restart the app
    await page.getByRole('button', { name: /Restart App/ }).click();

    // Wait for iframe to load
    const iframe = page.frameLocator('iframe[title="Browser Simulation"]');
    await iframe.getByText('PostHog ready for interactions').waitFor({ timeout: 10000 });

    // Check that the setting was passed to the iframe
    const logs = await iframe.locator('[data-testid="console-logs"] .log-entry').allTextContents();

    // Should see advanced_disable_flags: true in the initialization
    const advancedConfigLogs = logs.filter(log =>
      log.includes('advanced_disable_flags: true') ||
      log.includes('Setting advanced_disable_flags: true')
    );
    expect(advancedConfigLogs.length).toBeGreaterThan(0);

    // Should see warning about flags being disabled
    const warningLogs = logs.filter(log => log.includes('No flag calls possible'));
    expect(warningLogs.length).toBeGreaterThan(0);

    // User Identity component should show the informational message
    const userIdentity = iframe.locator('[data-testid="user-identity"]');
    await expect(userIdentity.getByText('advanced_disable_flags=true')).toBeVisible();
  });

  test('Advanced config: disable on first load should propagate correctly', async ({ page }) => {
    // Test advanced_disable_feature_flags_on_first_load setting
    await page.getByRole('combobox', { name: 'Web SDK Advanced Flag Config:' }).click();
    await page.getByRole('option', { name: 'advanced_disable_feature_flags_on_first_load: true' }).click();

    // Restart the app
    await page.getByRole('button', { name: /Restart App/ }).click();

    // Wait for iframe to load
    const iframe = page.frameLocator('iframe[title="Browser Simulation"]');
    await iframe.getByText('PostHog ready for interactions').waitFor({ timeout: 10000 });

    // Check that the setting was passed
    const logs = await iframe.locator('[data-testid="console-logs"] .log-entry').allTextContents();

    // Should see the setting in initialization
    const advancedConfigLogs = logs.filter(log =>
      log.includes('advanced_disable_feature_flags_on_first_load: true')
    );
    expect(advancedConfigLogs.length).toBeGreaterThan(0);

    // Should see message about flags loading after identify
    const flagLoadLogs = logs.filter(log =>
      log.includes('Flags will only load after identify() is called')
    );
    expect(flagLoadLogs.length).toBeGreaterThan(0);
  });

  test('Config changes should create new iframe instance', async ({ page }) => {
    // Get initial iframe
    const initialIframe = page.locator('iframe[title="Browser Simulation"]');
    const initialSrc = await initialIframe.getAttribute('src');

    // Change a setting
    await page.getByRole('combobox', { name: 'Flag evaluation method:' }).click();
    await page.getByRole('option', { name: 'Server side', exact: true }).click();

    // Restart the app
    await page.getByRole('button', { name: /Restart App/ }).click();

    // Check that iframe src changed (indicating new instance)
    await page.waitForTimeout(1000); // Wait for restart
    const newIframe = page.locator('iframe[title="Browser Simulation"]');
    const newSrc = await newIframe.getAttribute('src');

    expect(newSrc).not.toBe(initialSrc);
    expect(newSrc).toContain('server-side');
  });

  test('PostHog state should update correctly after identification in all modes', async ({ page }) => {
    // Test in client mode first
    await page.getByRole('combobox', { name: 'Flag evaluation method:' }).click();
    await page.getByRole('option', { name: 'Client side' }).click();
    await page.getByRole('button', { name: /Restart App/ }).click();

    const iframe = page.frameLocator('iframe[title="Browser Simulation"]');
    await iframe.getByText('PostHog ready for interactions').waitFor({ timeout: 10000 });

    // Check initial state (should be anonymous)
    const postHogStatus = iframe.locator('[data-testid="posthog-status"]');
    await expect(postHogStatus.getByText('No')).toBeVisible(); // Not identified

    // Identify a user
    await iframe.getByPlaceholder('Enter user ID').fill('client-test-user');
    await iframe.getByRole('button', { name: 'Identify User' }).click();

    // Check that state updates
    await expect(postHogStatus.getByText('Yes')).toBeVisible(); // Now identified
    await expect(postHogStatus.getByText('client-test-user')).toBeVisible();
  });

  test('Flag values should be preserved correctly in server mode', async ({ page }) => {
    // Switch to server mode with a user
    await page.getByRole('combobox', { name: 'Flag evaluation method:' }).click();
    await page.getByRole('option', { name: 'Server side', exact: true }).click();

    await page.getByPlaceholder('Enter distinct ID to pass from server (or leave empty for anonymous)').fill('flag-test-user');
    await page.getByRole('button', { name: /Restart App/ }).click();

    const iframe = page.frameLocator('iframe[title="Browser Simulation"]');
    await iframe.getByText('PostHog ready for interactions').waitFor({ timeout: 10000 });

    // Check that the bootstrapped distinct_id matches what we set
    const postHogStatus = iframe.locator('[data-testid="posthog-status"]');
    await expect(postHogStatus.getByText('flag-test-user')).toBeVisible();

    // Check that flag values are present (should have been evaluated server-side)
    const flagValue = postHogStatus.locator('[data-testid="flag-value"]');
    await expect(flagValue).not.toHaveText('not set'); // Should have an actual value
  });

  test('User identity component should update correctly with bootstrap data', async ({ page }) => {
    // Switch to server mode with specific user data
    await page.getByRole('combobox', { name: 'Flag evaluation method:' }).click();
    await page.getByRole('option', { name: 'Server side', exact: true }).click();

    // Set specific distinct_id for bootstrapping
    await page.getByPlaceholder('Enter distinct ID to pass from server (or leave empty for anonymous)').fill('bootstrap-test-user-123');

    // Restart the app to trigger server bootstrap
    await page.getByRole('button', { name: /Restart App/ }).click();

    const iframe = page.frameLocator('iframe[title="Browser Simulation"]');
    await iframe.getByText('PostHog ready for interactions').waitFor({ timeout: 10000 });

    // Verify the user identity component shows the bootstrapped distinct_id
    const postHogStatus = iframe.locator('[data-testid="posthog-status"]');

    // First, let's see what distinct_id is actually shown
    const distinctIdElement = postHogStatus.locator('span:has-text("Distinct ID:")').locator('..').locator('span').nth(1);
    const actualDistinctId = await distinctIdElement.textContent();
    console.log('Actual distinct_id shown:', actualDistinctId);

    // This is the key test - distinct_id should be visible immediately after bootstrap
    await expect(postHogStatus.getByText('bootstrap-test-user-123')).toBeVisible();

    // Should be marked as identified (not anonymous)
    await expect(postHogStatus.getByText('Yes')).toBeVisible(); // Is Identified: Yes

    // Flag should have an actual value (not "not set")
    const flagValue = postHogStatus.locator('[data-testid="flag-value"]');
    await expect(flagValue).not.toHaveText('not set');

    // Verify this happened due to bootstrap, not manual identify()
    // Check the console logs to ensure we see bootstrap behavior
    const logs = await iframe.locator('[data-testid="console-logs"] .log-entry').allTextContents();
    console.log('All logs:', logs.slice(0, 15)); // Show first 15 logs for debugging

    const bootstrapLogs = logs.filter(log => log.includes('Bootstrap flags provided'));
    expect(bootstrapLogs.length).toBeGreaterThan(0);

    // Check if we see the distinct_id bootstrap log
    const distinctIdBootstrapLogs = logs.filter(log => log.includes('Bootstrap distinct_id:'));
    console.log('Bootstrap distinct_id logs found:', distinctIdBootstrapLogs.length);

    // Should NOT see any identify() calls in the logs since this is pure bootstrap
    const identifyLogs = logs.filter(log => log.includes('🔄 Identifying user'));
    expect(identifyLogs).toHaveLength(0);
  });

});
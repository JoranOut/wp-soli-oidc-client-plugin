import { defineConfig } from '@playwright/test';

/**
 * Custom Playwright config for OIDC client plugin.
 *
 * Does NOT use @wordpress/scripts base config because its globalSetup
 * requires REST API discovery (Link header) on the baseURL, but our test
 * provider (8889) is a vanilla OIDC server that doesn't emit that header.
 * Our tests only need browser-based SSO flows, not REST API utilities.
 */
const config = defineConfig({
    testDir: 'e2e',
    retries: process.env.CI ? 1 : 0,
    reporter: [['html', { open: 'never' }]],
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:8888',
        screenshot: 'only-on-failure',
        video: process.env.CI ? 'retain-on-failure' : 'on',
        trace: 'retain-on-failure',
    },
    outputDir: 'test-results',
    webServer: {
        command: 'npm run wp-env:start',
        port: 8888,
        reuseExistingServer: true,
    },
});

export default config;

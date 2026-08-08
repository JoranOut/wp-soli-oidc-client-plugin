import { defineConfig } from '@playwright/test';

/**
 * Custom Playwright config for the Soli OIDC client plugin.
 *
 * Does NOT use @wordpress/scripts base config because its globalSetup
 * requires REST API discovery (Link header) on the baseURL, but our test
 * provider is a vanilla OIDC server that doesn't emit that header.
 * Our tests only need browser-based flows, not REST API utilities.
 */
const CLIENT_PORT = process.env.WP_ENV_PORT || '8888';
const CLIENT_URL = process.env.CLIENT_URL || `http://localhost:${ CLIENT_PORT }`;

const config = defineConfig({
    testDir: 'e2e',
    // Every spec mutates shared WordPress state (options, users, sessions) on a
    // single wp-env pair, so parallel workers would race each other.
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL: CLIENT_URL,
        screenshot: 'only-on-failure',
        video: process.env.CI ? 'retain-on-failure' : 'on',
        trace: 'retain-on-failure',
    },
    outputDir: 'test-results',
    webServer: {
        command: 'npm run env:start',
        url: `${ CLIENT_URL }/wp-login.php`,
        reuseExistingServer: true,
        timeout: 300000,
    },
});

export default config;

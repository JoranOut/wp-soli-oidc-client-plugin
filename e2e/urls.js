/**
 * Shared environment URLs for the E2E suite.
 *
 * wp-env's ports are configurable (WP_ENV_PORT / WP_ENV_TESTS_PORT), so nothing
 * in the suite hardcodes 8888/8889. Run against alternative ports with:
 *
 *   WP_ENV_PORT=9888 WP_ENV_TESTS_PORT=9889 npm run env:start
 *   WP_ENV_PORT=9888 WP_ENV_TESTS_PORT=9889 npm run test:e2e
 */
const CLIENT_PORT = process.env.WP_ENV_PORT || '8888';
const PROVIDER_PORT = process.env.WP_ENV_TESTS_PORT || '8889';

const CLIENT_URL = process.env.CLIENT_URL || `http://localhost:${ CLIENT_PORT }`;
const PROVIDER_URL = process.env.PROVIDER_URL || `http://localhost:${ PROVIDER_PORT }`;

module.exports = { CLIENT_PORT, PROVIDER_PORT, CLIENT_URL, PROVIDER_URL };

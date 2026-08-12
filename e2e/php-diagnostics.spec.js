/**
 * PHP diagnostics on the surfaces this plugin renders.
 *
 * The plugin's user-visible work happens on `wp-login.php`: `Login_Customizer`
 * filters `login_message` and hooks `login_enqueue_scripts`, and every rejected
 * OIDC callback lands back there. That is a front-end request - it runs with no
 * session and outside `wp-admin` - so an admin-side assertion says nothing about
 * it. `plugin-surface.spec.js` covers the admin requests.
 *
 * Hermetic: nothing here completes a handshake. The success path
 * (`openid-connect-generic-update-user-using-current-claim`, which drives
 * `Role_Sync` and `Assignments_Sync`) needs a real token exchange and is
 * exercised by role-sync.spec.js and claim-sync.spec.js against the local test
 * provider; it is not asserted here, and nothing in this suite talks to the
 * production provider at admin.soli.nl.
 *
 * Each test proves the plugin's own output is on the page before asserting on
 * diagnostics, so a surface that silently stopped rendering cannot make the
 * assertion vacuous.
 */
const { test, expect } = require( '@playwright/test' );
const { CLIENT_URL } = require( './urls' );
const { loginAsAdmin, expectNoPhpDiagnostics } = require( './helpers' );

test.describe( 'Front-end PHP diagnostics', () => {
	test.beforeEach( async ( { context } ) => {
		await context.clearCookies();
	} );

	// Every page these tests load runs the plugin, so each one is also a
	// diagnostics probe. Asserting here means a test cannot be added later that
	// silently skips the check.
	test.afterEach( async ( { page } ) => {
		if ( ! page.url().startsWith( 'http' ) ) {
			return;
		}

		await expectNoPhpDiagnostics( page );
	} );

	test( 'on the native login form reached with bypass-sso', async ( {
		page,
	} ) => {
		await page.goto( `${ CLIENT_URL }/wp-login.php?bypass-sso` );

		// maybe_disable_sso ran, otherwise we would be on the provider and the
		// assertion would be reading someone else's page.
		expect( page.url() ).toContain( CLIENT_URL );
		await expect( page.locator( '#loginform' ) ).toBeVisible();

		await expectNoPhpDiagnostics( page );
	} );

	test( 'on the login error page the plugin renders', async ( { page } ) => {
		await page.goto(
			`${ CLIENT_URL }/wp-login.php?login-error=http_request_failed&message=Test+error`
		);

		// add_retry_button_on_error produced output, so the code path under
		// assertion actually executed.
		await expect(
			page.locator( 'a' ).filter( { hasText: 'Probeer opnieuw' } )
		).toBeVisible();

		await expectNoPhpDiagnostics( page );
	} );

	test( 'on a rejected OIDC callback with no parameters', async ( {
		page,
	} ) => {
		await page.goto(
			`${ CLIENT_URL }/wp-admin/admin-ajax.php?action=openid-connect-authorize`
		);

		expect( page.url() ).toContain( 'login-error' );

		await expectNoPhpDiagnostics( page );
	} );

	test( 'on a rejected OIDC callback with a bogus code and state', async ( {
		page,
	} ) => {
		await page.goto(
			`${ CLIENT_URL }/wp-admin/admin-ajax.php?action=openid-connect-authorize&code=not-a-real-code&state=not-a-real-state`
		);

		expect( page.url() ).toContain( 'login-error' );

		await expectNoPhpDiagnostics( page );
	} );

	test( 'on the public home page as an anonymous visitor', async ( {
		page,
	} ) => {
		// The plugin's top-level file, dependency checker and settings
		// registration run on every request, including one with no session.
		await page.goto( `${ CLIENT_URL }/` );

		await expect( page.locator( 'body' ) ).toBeVisible();

		await expectNoPhpDiagnostics( page );
	} );

	test( 'on the plugin settings page', async ( { page } ) => {
		await loginAsAdmin( page );
		await page.goto(
			`${ CLIENT_URL }/wp-admin/options-general.php?page=soli-oidc-client`
		);

		// The settings fields rendered, so Settings::render ran.
		await expect(
			page.locator( 'input[name="soli_oidc_client_logout_url"]' )
		).toBeVisible();

		await expectNoPhpDiagnostics( page );
	} );
} );

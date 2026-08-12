/**
 * Plugin surface tests.
 *
 * Hermetic: these never complete an OIDC handshake. They cover what breaks first
 * when the plugin regresses - it stops loading, a class or namespace is renamed,
 * a hook is no longer registered, or the settings page stops saving.
 */
const { test, expect } = require( '@playwright/test' );
const { CLIENT_URL } = require( './urls' );
const { loginAsAdmin, ajax, expectNoPhpDiagnostics } = require( './helpers' );

const PLUGIN_ROW =
	'tr[data-plugin="wp-soli-oidc-client-plugin/wp-soli-oidc-client-plugin.php"]';

test.describe( 'Plugin surface', () => {
	test( 'plugin is active and loads without PHP errors', async ( {
		page,
	} ) => {
		await loginAsAdmin( page );
		await page.goto( `${ CLIENT_URL }/wp-admin/plugins.php` );

		await expect( page.locator( PLUGIN_ROW ) ).toHaveClass( /active/ );

		// WP_DEBUG_DISPLAY is on, so anything the plugin raises while loading
		// would be printed straight into the page.
		//
		// Previously asserted with an unscoped pattern, which would have failed
		// on any deprecation from the third-party daggerhart plugin this one
		// adapts. The shared helper scopes the softer diagnostics to this repo's
		// own files while keeping fatals unscoped. This only covers the admin
		// request; the login screen is a front-end surface and is asserted in
		// php-diagnostics.spec.js.
		await expectNoPhpDiagnostics( page );
	} );

	test( 'plugin registers its classes, constants and claim hook', async ( {
		page,
	} ) => {
		await loginAsAdmin( page );

		const { status, body } = await ajax( page, 'soli_oidc_test_status' );

		expect( status ).toBe( 200 );
		expect( body.success ).toBe( true );
		expect( body.data.version ).toMatch( /^\d+\.\d+\.\d+/ );

		expect( body.data.classes ).toEqual( {
			Dependency_Checker: true,
			Settings: true,
			Role_Sync: true,
			Assignments_Sync: true,
			Login_Customizer: true,
		} );

		expect( body.data.oidc_client_active ).toBe( true );
		expect( body.data.claim_hook_registered ).toBe( true );
		expect( body.data.login_message_filter ).toBe( true );
	} );

	test( 'version constant matches the version in readme.md', async ( {
		page,
		request,
	} ) => {
		await loginAsAdmin( page );
		const { body } = await ajax( page, 'soli_oidc_test_status' );

		const readme = await request.get(
			`${ CLIENT_URL }/wp-content/plugins/wp-soli-oidc-client-plugin/readme.md`
		);
		expect( readme.ok() ).toBe( true );

		const match = ( await readme.text() ).match(
			/~Current Version:\s*([^~]+)~/
		);
		expect( match ).not.toBeNull();
		expect( match[ 1 ].trim() ).toBe( body.data.version );
	} );

	test( 'no dependency notice while the OIDC client plugin is active', async ( {
		page,
	} ) => {
		await loginAsAdmin( page );
		await page.goto( `${ CLIENT_URL }/wp-admin/index.php` );

		await expect(
			page.locator( '.notice-error', { hasText: 'Soli OIDC Client' } )
		).toHaveCount( 0 );
	} );

	test( 'settings page renders in Dutch and persists the provider logout URL', async ( {
		page,
	} ) => {
		await loginAsAdmin( page );
		const settingsUrl = `${ CLIENT_URL }/wp-admin/options-general.php?page=soli-oidc-client`;
		await page.goto( settingsUrl );

		// The nl_NL catalogue must be loaded for the plugin's own strings.
		await expect(
			page.getByText( 'Provider uitlog-URL', { exact: false } )
		).toBeVisible();

		const field = page.locator(
			'input[name="soli_oidc_client_logout_url"]'
		);
		await expect( field ).toBeVisible();

		const original = await field.inputValue();
		expect( original ).not.toBe( '' );

		await field.fill( 'https://admin.soli.nl/oauth/logout' );
		await page.locator( '#submit' ).click();

		// Reload from scratch: the value must have reached the database.
		await page.goto( settingsUrl );
		await expect( field ).toHaveValue(
			'https://admin.soli.nl/oauth/logout'
		);

		// Restore so the login-customizer spec still points at the test provider.
		await field.fill( original );
		await page.locator( '#submit' ).click();
		await page.goto( settingsUrl );
		await expect( field ).toHaveValue( original );
	} );

	test( 'settings page requires an authenticated session', async ( {
		request,
	} ) => {
		// The `request` fixture has its own cookie jar, so this is anonymous.
		const response = await request.get(
			`${ CLIENT_URL }/wp-admin/options-general.php?page=soli-oidc-client`,
			{ maxRedirects: 0 }
		);

		expect( response.status() ).toBe( 302 );
		expect( response.headers().location ).toContain( 'wp-login.php' );
	} );

	test( 'test-helper endpoints are not served to anonymous callers', async ( {
		request,
	} ) => {
		// admin-ajax.php is publicly reachable, so verify the fixture's
		// endpoints are registered for logged-in users only and leak nothing.
		for ( const action of [
			'soli_oidc_test_status',
			'soli_oidc_test_apply_claim',
			'soli_oidc_test_delete_user',
			'soli_oidc_check_assignments',
		] ) {
			const response = await request.get(
				`${ CLIENT_URL }/wp-admin/admin-ajax.php?action=${ action }`
			);

			// WordPress answers 400 for an action with no _nopriv handler.
			expect( response.status() ).toBe( 400 );
			expect( await response.text() ).not.toContain( 'success' );
		}
	} );
} );

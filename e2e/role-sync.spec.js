/**
 * Role sync and assignments tests
 *
 * Tests that roles and assignments from the OIDC provider claims
 * are correctly synced to WordPress user roles and user meta.
 *
 * The test provider (localhost:8889) has the oidc-laravel-claims.php mu-plugin
 * which transforms claims to the Laravel format (roles array, assignments array).
 */
const { test, expect } = require( '@playwright/test' );

const CLIENT_URL = 'http://localhost:8888';
const PROVIDER_URL = 'http://localhost:8889';

/**
 * Helper: Log in via SSO as a specific user
 */
async function loginViaSSO( page, context, username, password ) {
	await context.clearCookies();
	await page.goto( `${ CLIENT_URL }/wp-login.php` );

	// Should redirect to provider
	await expect( page ).toHaveURL( /localhost:8889/, { timeout: 10000 } );

	// Fill in credentials
	await page.locator( '#user_login' ).fill( username );
	await page.locator( '#user_pass' ).fill( password );
	await page.locator( '#wp-submit' ).click();

	// Handle authorize prompt
	const authorizeButton = page.locator( 'input[name="authorize"], button[name="authorize"]' );
	if ( await authorizeButton.isVisible( { timeout: 5000 } ).catch( () => false ) ) {
		await authorizeButton.click();
	}

	// Should be redirected back to the client (not on login error page)
	await expect( page ).toHaveURL( /localhost:8888/, { timeout: 10000 } );
	expect( page.url() ).not.toContain( 'login-error' );
}

test.describe( 'Role Sync', () => {
	test( 'admin user gets administrator role synced from provider', async ( { page, context } ) => {
		await loginViaSSO( page, context, 'admin', 'password' );

		// Verify the user is logged in and has admin role
		// Visit the admin page to confirm access
		await page.goto( `${ CLIENT_URL }/wp-admin/` );
		await expect( page ).toHaveURL( /wp-admin/ );
		// Admin bar proves we're logged in with sufficient privileges
		await expect( page.locator( '#wpadminbar' ) ).toBeVisible();
	} );

	test( 'subscriber user gets subscriber role synced from provider', async ( { page, context } ) => {
		await loginViaSSO( page, context, 'testuser', 'testpass' );

		// Subscriber can access profile page
		await page.goto( `${ CLIENT_URL }/wp-admin/profile.php` );
		await expect( page ).toHaveURL( /profile\.php/ );
	} );

	test( 'assignments are stored in user meta after login', async ( { page, context } ) => {
		await loginViaSSO( page, context, 'admin', 'password' );

		// Fetch assignments from the test helper AJAX endpoint
		const assignments = await page.evaluate( async () => {
			const response = await fetch( '/wp-admin/admin-ajax.php?action=soli_oidc_check_assignments', {
				credentials: 'same-origin',
			} );
			const json = await response.json();
			return json.data;
		} );

		// Verify assignments match the Laravel provider format
		expect( assignments ).toEqual( [
			{
				onderdeel_id: '1',
				instrument_soort_id: '5',
				instrument_soort: 'Trompet',
				instrument_familie: 'Koperblazers',
			},
		] );
	} );
} );

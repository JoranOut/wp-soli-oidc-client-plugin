/**
 * Role sync and assignments over the real handshake.
 *
 * The provider (tests environment) runs the oidc-laravel-claims.php mu-plugin,
 * which shapes claims the way the Soli Laravel provider does: a `roles` array and
 * an `assignments` array. These tests prove the claims survive the round trip and
 * land in WordPress, which the hermetic claim-sync.spec.js cannot show.
 */
const { test, expect } = require( '@playwright/test' );
const { CLIENT_URL } = require( './urls' );
const { loginViaSSO, ajax } = require( './helpers' );

test.describe( 'Role Sync over SSO', () => {
	test( 'the provider administrator lands on the client with admin access', async ( {
		page,
		context,
	} ) => {
		await loginViaSSO( page, context, 'admin', 'password' );

		await page.goto( `${ CLIENT_URL }/wp-admin/options-general.php` );
		// Only a user with manage_options can read this screen.
		await expect( page.locator( '#wpadminbar' ) ).toBeVisible();
		await expect( page.locator( 'form#general-settings, form' ) ).toBeVisible();
	} );

	test( 'a provider subscriber gets subscriber-level access, not admin', async ( {
		page,
		context,
	} ) => {
		await loginViaSSO( page, context, 'testuser', 'testpass' );

		await page.goto( `${ CLIENT_URL }/wp-admin/profile.php` );
		expect( page.url() ).toContain( 'profile.php' );

		// A synced subscriber must not have been granted manage_options.
		await page.goto( `${ CLIENT_URL }/wp-admin/options-general.php` );
		await expect(
			page.locator( 'input[name="soli_oidc_client_logout_url"]' )
		).toHaveCount( 0 );
	} );

	test( 'assignments from the provider are stored in user meta', async ( {
		page,
		context,
	} ) => {
		await loginViaSSO( page, context, 'admin', 'password' );

		const { body } = await ajax( page, 'soli_oidc_check_assignments' );

		expect( body.success ).toBe( true );
		expect( body.data ).toEqual( [
			{
				onderdeel_id: '1',
				onderdeel: 'Harmonie orkest',
				onderdeel_slug: 'harmonie-orkest',
				instrument_soort_id: '5',
				instrument_soort: 'Trompet',
				instrument_familie: 'Koperblazers',
			},
		] );
	} );
} );

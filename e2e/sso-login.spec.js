/**
 * SSO login flow tests.
 *
 * These drive the full OIDC handshake: the client environment authenticates
 * against the provider environment (the OpenID Connect Server plugin plus the
 * Laravel-shaped claims fixture). Both are wp-env instances, so the suite stays
 * self-contained - it never talks to a real Soli identity provider.
 */
const { test, expect } = require( '@playwright/test' );
const { CLIENT_URL, PROVIDER_URL } = require( './urls' );
const { loginViaSSO } = require( './helpers' );

test.describe( 'SSO Login Flow', () => {
	test.beforeEach( async ( { context } ) => {
		await context.clearCookies();
	} );

	test( 'an unauthenticated visit to wp-login.php is redirected to the provider', async ( {
		request,
	} ) => {
		// Inspect the client's own redirect rather than the page's final URL,
		// which is wherever the provider chooses to send us next.
		const response = await request.get( `${ CLIENT_URL }/wp-login.php`, {
			maxRedirects: 0,
		} );

		expect( response.status() ).toBe( 302 );

		const location = response.headers().location;
		expect( location ).toContain( PROVIDER_URL );
		expect( location ).toContain( 'openid-connect' );
		expect( location ).toContain( 'response_type=code' );
		expect( location ).toContain( 'client_id=soli-dev-client' );
		expect( decodeURIComponent( location ) ).toContain(
			`${ CLIENT_URL }/wp-admin/admin-ajax.php?action=openid-connect-authorize`
		);
	} );

	test( 'SSO auto-redirects to the provider and logs the user in', async ( {
		page,
		context,
	} ) => {
		await loginViaSSO( page, context, 'admin', 'password' );

		await expect( page.locator( '#wpadminbar' ) ).toBeVisible( {
			timeout: 10000,
		} );
	} );
} );

/**
 * Login page customisation and error handling.
 *
 * Hermetic: these only exercise the client's own login screen and its handling
 * of missing or malformed callback parameters. No successful handshake required.
 */
const { test, expect } = require( '@playwright/test' );
const { CLIENT_URL, PROVIDER_URL } = require( './urls' );

test.describe( 'Login customizer', () => {
	test.beforeEach( async ( { context } ) => {
		await context.clearCookies();
	} );

	test( 'bypass-sso shows the regular WordPress login form', async ( {
		page,
	} ) => {
		await page.goto( `${ CLIENT_URL }/wp-login.php?bypass-sso` );

		// Must not have been redirected to the provider.
		expect( page.url() ).toContain( CLIENT_URL );
		await expect( page.locator( '#user_login' ) ).toBeVisible();
		await expect( page.locator( '#user_pass' ) ).toBeVisible();
	} );

	test( 'the login error page shows a retry button and hides the form', async ( {
		page,
	} ) => {
		await page.goto(
			`${ CLIENT_URL }/wp-login.php?login-error=http_request_failed&message=Test+error`
		);

		expect( page.url() ).toContain( CLIENT_URL );
		await expect( page.locator( '#login_error' ) ).toContainText(
			'Test error'
		);

		// The label comes from the plugin's nl_NL catalogue.
		const retry = page.locator( 'a' ).filter( { hasText: 'Probeer opnieuw' } );
		await expect( retry ).toBeVisible();

		// It must clear the provider session and come back to this login page.
		const href = await retry.getAttribute( 'href' );
		expect( href ).toContain( PROVIDER_URL );
		expect( href ).toContain( 'action=logout' );
		expect( href ).toContain( 'redirect_uri=' );
		expect( decodeURIComponent( href ) ).toContain(
			`${ CLIENT_URL }/wp-login.php`
		);

		await expect( page.locator( '#loginform' ) ).toBeHidden();
	} );

	test( 'no retry button is added on a normal login page', async ( {
		page,
	} ) => {
		await page.goto( `${ CLIENT_URL }/wp-login.php?bypass-sso` );

		await expect(
			page.locator( 'a' ).filter( { hasText: 'Probeer opnieuw' } )
		).toHaveCount( 0 );
		await expect( page.locator( '#login_error' ) ).toHaveCount( 0 );
	} );

	test( 'an OIDC callback with no parameters fails into the error page, not a 500', async ( {
		page,
	} ) => {
		const response = await page.goto(
			`${ CLIENT_URL }/wp-admin/admin-ajax.php?action=openid-connect-authorize`
		);

		expect( response.status() ).toBeLessThan( 500 );
		expect( page.url() ).toContain( 'login-error' );
		await expect(
			page.locator( 'a' ).filter( { hasText: 'Probeer opnieuw' } )
		).toBeVisible();
	} );

	test( 'an OIDC callback with a bogus code and state fails into the error page', async ( {
		page,
	} ) => {
		const response = await page.goto(
			`${ CLIENT_URL }/wp-admin/admin-ajax.php?action=openid-connect-authorize&code=not-a-real-code&state=not-a-real-state`
		);

		expect( response.status() ).toBeLessThan( 500 );
		expect( page.url() ).toContain( 'login-error' );

		// A rejected callback must never leave the visitor logged in.
		await expect( page.locator( '#wpadminbar' ) ).toHaveCount( 0 );
	} );

	test( 'the error page suppresses SSO auto-redirect so the user is not looped', async ( {
		page,
	} ) => {
		await page.goto(
			`${ CLIENT_URL }/wp-login.php?login-error=token_validation_failed&message=Bad+token`
		);

		// Without maybe_disable_sso this request would bounce straight back to
		// the provider and the user could never read the error.
		expect( page.url() ).toContain( CLIENT_URL );
		expect( page.url() ).not.toContain( PROVIDER_URL );
	} );
} );
